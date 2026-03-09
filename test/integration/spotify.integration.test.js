import test, { mock } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Track from "../../src/models/Track.js";
import { createSpotifyClient } from "../../src/services/spotify/client.js";
import { enrichTracks } from "../../src/services/spotify/enrichSpotify.js";

test("Spotify Enrichment Integration", async (t) => {
  let mongoServer;

  t.beforeEach(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  t.afterEach(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    mock.restoreAll();
  });

  await t.test("should enrich tracks sequentially from db saving full metadata", async () => {
    // 1. Seed the database with a track missing a spotifyId
    const track = await Track.create({
      artist: "Daft Punk",
      title: "Get Lucky",
      genreVector: Array(20).fill(0.1),
    });

    // 2. Mock fetch to simulate the Spotify API responses for token and search
    const mockFetch = mock.fn(async (url, options) => {
      const urlStr = url.toString();

      if (urlStr.includes("token")) {
        return {
          ok: true,
          json: async () => ({ access_token: "integration_token", expires_in: 3600 }),
        };
      }

      if (urlStr.includes("search")) {
        // Assert we search for Get Lucky by Daft Punk
        assert.ok(urlStr.includes("Get+Lucky"));
        assert.ok(urlStr.includes("Daft+Punk"));

        return {
          ok: true,
          json: async () => ({
            tracks: {
              items: [
                {
                  id: "5NV6Rpi10F8VglTKJ0qOBX",
                  uri: "spotify:track:5NV6Rpi10F8VglTKJ0qOBX",
                  duration_ms: 247000,
                  explicit: false,
                  album: {
                    images: [
                      { url: "img640", height: 640, width: 640 },
                      { url: "img300", height: 300, width: 300 },
                      { url: "img64", height: 64, width: 64 },
                    ],
                  },
                },
              ],
            },
          }),
        };
      }

      return { ok: false, status: 404, text: async () => "Not found" };
    });

    // 3. Run the enricher logic
    const client = createSpotifyClient({
      clientId: "int_client",
      clientSecret: "int_secret",
      fetch: mockFetch,
      rateLimit: false,
    });

    const result = await enrichTracks(client);

    // 4. Verify the enricher result stats
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.enriched, 1);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 0);

    // 5. Verify the actual MongoDB document has been updated
    const updatedTrack = await Track.findById(track._id).lean();

    assert.strictEqual(updatedTrack.spotifyId, "5NV6Rpi10F8VglTKJ0qOBX");
    assert.strictEqual(updatedTrack.spotifyUri, "spotify:track:5NV6Rpi10F8VglTKJ0qOBX");
    assert.strictEqual(updatedTrack.duration, 247);
    assert.strictEqual(updatedTrack.explicit, false);
    assert.strictEqual(updatedTrack.albumImages.length, 3);
    assert.strictEqual(updatedTrack.albumImages[0].url, "img640");
  });
});
