import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Track from "../../src/models/Track.js";
import { enrichCfData } from "../../src/services/cf/enrichCf.js";

let mongod;

async function setup() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

async function teardown() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
}

function createMockClient({ trackSimilar = [], artistSimilar = [] } = {}) {
  const calls = { trackSimilar: [], artistSimilar: [] };
  return {
    calls,
    getTrackSimilar: async (artist, title) => {
      calls.trackSimilar.push({ artist, title });
      if (typeof trackSimilar === "function") return trackSimilar(artist, title);
      return trackSimilar;
    },
    getArtistSimilar: async (artist) => {
      calls.artistSimilar.push({ artist });
      if (typeof artistSimilar === "function") return artistSimilar(artist);
      return artistSimilar;
    },
  };
}

describe("enrichCfData", () => {
  beforeEach(setup);
  afterEach(teardown);

  it("enriches tracks with similar data", async () => {
    await Track.create({
      title: "Song A",
      artist: "Artist X",
      genreVector: new Array(20).fill(0.5),
    });

    const client = createMockClient({
      trackSimilar: [{ artist: "Y", title: "Song B", match: 0.8 }],
      artistSimilar: [{ artist: "Z", match: 0.7 }],
    });

    const result = await enrichCfData(client);

    assert.equal(result.total, 1);
    assert.equal(result.enriched, 1);
    assert.equal(result.skipped, 0);
    assert.equal(result.failed, 0);

    const updated = await Track.findOne({ title: "Song A" }).lean();
    assert.equal(updated.similarTracks.length, 1);
    assert.equal(updated.similarTracks[0].artist, "Y");
    assert.equal(updated.similarArtists.length, 1);
    assert.equal(updated.similarArtists[0].artist, "Z");
    assert.ok(updated.cfEnrichedAt instanceof Date);
  });

  it("skips already enriched tracks", async () => {
    await Track.create({
      title: "Already Done",
      artist: "X",
      genreVector: new Array(20).fill(0.5),
      cfEnrichedAt: new Date(),
    });
    await Track.create({
      title: "Not Done",
      artist: "Y",
      genreVector: new Array(20).fill(0.5),
    });

    const client = createMockClient({
      trackSimilar: [{ artist: "A", title: "B", match: 0.5 }],
      artistSimilar: [{ artist: "C", match: 0.5 }],
    });

    const result = await enrichCfData(client);

    assert.equal(result.total, 1);
    assert.equal(result.enriched, 1);
  });

  it("deduplicates artist.getSimilar calls per unique artist", async () => {
    await Track.create({ title: "Song 1", artist: "Queen", genreVector: new Array(20).fill(0.5) });
    await Track.create({ title: "Song 2", artist: "Queen", genreVector: new Array(20).fill(0.5) });
    await Track.create({ title: "Song 3", artist: "queen", genreVector: new Array(20).fill(0.5) });

    const client = createMockClient({
      trackSimilar: [{ artist: "A", title: "B", match: 0.5 }],
      artistSimilar: [{ artist: "C", match: 0.5 }],
    });

    const result = await enrichCfData(client);

    assert.equal(result.total, 3);
    assert.equal(result.enriched, 3);
    // artist.getSimilar should be called only once (deduped by lowercase)
    assert.equal(client.calls.artistSimilar.length, 1);
    // track.getSimilar still called per track
    assert.equal(client.calls.trackSimilar.length, 3);
  });

  it("marks as skipped when no similar data but still sets cfEnrichedAt", async () => {
    await Track.create({ title: "Solo", artist: "Unknown", genreVector: new Array(20).fill(0.5) });

    const client = createMockClient({ trackSimilar: [], artistSimilar: [] });

    const result = await enrichCfData(client);

    assert.equal(result.total, 1);
    assert.equal(result.skipped, 1);
    assert.equal(result.enriched, 0);

    const updated = await Track.findOne({ title: "Solo" }).lean();
    assert.ok(updated.cfEnrichedAt instanceof Date);
  });

  it("respects batchSize", async () => {
    for (let i = 0; i < 5; i++) {
      await Track.create({
        title: `Song ${i}`,
        artist: `A${i}`,
        genreVector: new Array(20).fill(0.5),
      });
    }

    const client = createMockClient({
      trackSimilar: [{ artist: "X", title: "Y", match: 0.5 }],
      artistSimilar: [{ artist: "Z", match: 0.5 }],
    });

    const result = await enrichCfData(client, { batchSize: 2 });

    assert.equal(result.total, 2);
  });

  it("counts failed tracks and continues", async () => {
    await Track.create({ title: "Good", artist: "A", genreVector: new Array(20).fill(0.5) });
    await Track.create({ title: "Bad", artist: "B", genreVector: new Array(20).fill(0.5) });

    let callCount = 0;
    const client = createMockClient({
      trackSimilar: (artist) => {
        callCount++;
        if (artist === "B") throw new Error("API down");
        return [{ artist: "X", title: "Y", match: 0.5 }];
      },
      artistSimilar: [{ artist: "Z", match: 0.5 }],
    });

    const result = await enrichCfData(client);

    assert.equal(result.total, 2);
    assert.equal(result.enriched, 1);
    assert.equal(result.failed, 1);
    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0].includes("API down"));
  });

  it("returns response shape matching apiContract", async () => {
    const client = createMockClient();
    const result = await enrichCfData(client);

    assert.ok("total" in result);
    assert.ok("enriched" in result);
    assert.ok("skipped" in result);
    assert.ok("failed" in result);
    assert.ok(Array.isArray(result.errors));
  });
});
