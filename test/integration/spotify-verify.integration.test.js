import test, { mock } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Track from "../../src/models/Track.js";
import { enrichTracks } from "../../src/services/spotify/enrichSpotify.js";
import { createSpotifyClient } from "../../src/services/spotify/client.js";

test("Spotify Verify Integration", async (t) => {
  let mongoServer;

  t.before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Track.syncIndexes();
  });

  t.after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  t.beforeEach(async () => {
    await Track.deleteMany({});
    mock.restoreAll();
  });

  // --- Test 3: Sparse index (REQ-004) ---

  await t.test(
    "REQ-004: Sparse index — twee tracks zonder spotifyId bestaan naast elkaar",
    async () => {
      const t1 = await Track.create({ title: "T1", artist: "A1", genreVector: Array(20).fill(0) });
      const t2 = await Track.create({ title: "T2", artist: "A2", genreVector: Array(20).fill(0) });

      // Both should exist — sparse index allows multiple absent values
      assert.ok(t1._id);
      assert.ok(t2._id);
      assert.strictEqual(t1.spotifyId, undefined);
      assert.strictEqual(t2.spotifyId, undefined);
    },
  );

  await t.test("REQ-004: Sparse index — duplicate spotifyId geweigerd", async () => {
    await Track.create({
      title: "T1",
      artist: "A1",
      genreVector: Array(20).fill(0),
      spotifyId: "dup-id",
    });

    await assert.rejects(
      () =>
        Track.create({
          title: "T2",
          artist: "A2",
          genreVector: Array(20).fill(0),
          spotifyId: "dup-id",
        }),
      (err) => {
        assert.strictEqual(err.code, 11000);
        return true;
      },
    );
  });

  // --- Test 4: Skip already-enriched tracks (REQ-005) ---

  await t.test("REQ-005: enrichTracks slaat tracks met bestaande spotifyId over", async () => {
    // Track met spotifyId (already enriched)
    await Track.create({
      title: "Already",
      artist: "Enriched",
      genreVector: Array(20).fill(0),
      spotifyId: "existing-sp-id",
    });

    // Track zonder spotifyId (needs enrichment)
    await Track.create({
      title: "Needs",
      artist: "Enrichment",
      genreVector: Array(20).fill(0),
    });

    let searchCallCount = 0;
    const mockClient = {
      searchTrack: async (artist, title) => {
        searchCallCount++;
        return {
          spotifyId: "new-sp-id",
          spotifyUri: "spotify:track:new-sp-id",
          duration: 200,
          explicit: false,
          albumImages: [],
        };
      },
    };

    const result = await enrichTracks(mockClient);

    assert.strictEqual(result.total, 1, "Should only find 1 unenriched track");
    assert.strictEqual(result.enriched, 1);
    assert.strictEqual(searchCallCount, 1, "searchTrack called exactly once");

    // Verify original track untouched
    const original = await Track.findOne({ artist: "Enriched" }).lean();
    assert.strictEqual(original.spotifyId, "existing-sp-id", "Original spotifyId unchanged");

    // Verify new track enriched
    const enriched = await Track.findOne({ artist: "Enrichment" }).lean();
    assert.strictEqual(enriched.spotifyId, "new-sp-id");
  });

  // --- Test 5: Batch error isolation (REQ-005) ---

  await t.test("REQ-005: Error in één track abort niet de batch", async () => {
    await Track.create({ title: "T1", artist: "A1", genreVector: Array(20).fill(0) });
    await Track.create({ title: "T2", artist: "A2", genreVector: Array(20).fill(0) });
    await Track.create({ title: "T3", artist: "A3", genreVector: Array(20).fill(0) });

    let callCount = 0;
    const mockClient = {
      searchTrack: async (artist, title) => {
        callCount++;
        if (artist === "A2") throw new Error("Spotify timeout on A2");
        return {
          spotifyId: `sp-${artist}`,
          spotifyUri: `spotify:track:sp-${artist}`,
          duration: 200,
          explicit: false,
          albumImages: [],
        };
      },
    };

    const result = await enrichTracks(mockClient);

    // All 3 tracks should be attempted
    assert.strictEqual(callCount, 3, "All 3 tracks should be searched");
    assert.strictEqual(result.failed, 1, "1 error (A2)");
    assert.strictEqual(result.enriched, 2, "2 enriched (A1 + A3)");

    // Verify A1 and A3 are enriched, A2 is not
    const a1 = await Track.findOne({ artist: "A1" }).lean();
    const a2 = await Track.findOne({ artist: "A2" }).lean();
    const a3 = await Track.findOne({ artist: "A3" }).lean();

    assert.strictEqual(a1.spotifyId, "sp-A1");
    assert.strictEqual(a2.spotifyId, undefined, "A2 should not be enriched");
    assert.strictEqual(a3.spotifyId, "sp-A3");
  });
});
