import { after, before, describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import GenreSliders from "../../src/models/GenreSliders.js";
import { processOnboarding } from "../../src/services/onboarding/onboard.js";
import { GENRES } from "../../src/config/genres.js";

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await GenreSliders.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await GenreSliders.deleteMany({});
});

function mockLastfmClient(tagMap = {}) {
  return {
    getArtistTopTags: async (artist) => tagMap[artist] || [],
  };
}

// REQ-001: processOnboarding retourneert profiel met vector + meta + sliders
describe("REQ-001: processOnboarding orchestratie", () => {
  it("retourneert profile met vector (20 floats) en meta + sliders", async () => {
    const result = await processOnboarding({
      userId: "user-1",
      genres: ["rock", "pop", "jazz"],
      artists: ["Radiohead", "Daft Punk", "Miles Davis"],
      app: "sonarpop",
      lastfmClient: mockLastfmClient(),
    });

    assert.ok(result.profile, "moet profile bevatten");
    assert.equal(result.profile.vector.length, 20, "vector moet 20 floats zijn");
    assert.ok(result.profile.meta.topGenre, "moet topGenre bevatten");
    assert.ok(typeof result.profile.meta.activeGenres === "number");
    assert.ok(result.sliders, "moet sliders bevatten");
    assert.equal(Object.keys(result.sliders).length, GENRES.length);
  });
});

// REQ-005: GenreSliders upsert + idempotentie
describe("REQ-005: GenreSliders upsert", () => {
  it("maakt GenreSliders document aan bij eerste onboarding", async () => {
    await processOnboarding({
      userId: "user-upsert",
      genres: ["rock", "pop", "jazz"],
      artists: [],
      app: "poppy",
      lastfmClient: mockLastfmClient(),
    });

    const doc = await GenreSliders.findOne({ userId: "user-upsert" });
    assert.ok(doc, "GenreSliders document moet bestaan");
    assert.equal(doc.sliders.get("rock"), 1.0);
    assert.equal(doc.sliders.get("pop"), 1.0);
    assert.equal(doc.sliders.get("jazz"), 1.0);
  });

  it("overschrijft weights bij herhaalde onboarding", async () => {
    // Eerste onboarding
    await processOnboarding({
      userId: "user-idempotent",
      genres: ["rock", "pop", "jazz"],
      artists: [],
      app: "poppy",
      lastfmClient: mockLastfmClient(),
    });

    // Tweede onboarding met andere genres
    await processOnboarding({
      userId: "user-idempotent",
      genres: ["electronic", "ambient", "dance"],
      artists: [],
      app: "poppy",
      lastfmClient: mockLastfmClient(),
    });

    const doc = await GenreSliders.findOne({ userId: "user-idempotent" });
    assert.equal(doc.sliders.get("electronic"), 1.0, "electronic moet 1.0 zijn");
    assert.equal(doc.sliders.get("rock"), 0.1, "rock moet teruggevallen zijn naar 0.1");
  });
});

// REQ-006: Profile vector consistent met weights
describe("REQ-006: Profile response consistent met weights", () => {
  it("topGenre komt overeen met hoogste weight", async () => {
    const result = await processOnboarding({
      userId: "user-profile",
      genres: ["rock", "pop", "jazz"],
      artists: [],
      app: "poppy",
      lastfmClient: mockLastfmClient(),
    });

    // rock, pop, jazz all 1.0 — topGenre should be one of them
    const topGenres = ["rock", "pop", "jazz"];
    assert.ok(
      topGenres.includes(result.profile.meta.topGenre),
      `topGenre should be one of ${topGenres}, got ${result.profile.meta.topGenre}`,
    );
  });

  it("activeGenres telt genres met weight > 0", async () => {
    const result = await processOnboarding({
      userId: "user-active",
      genres: ["rock", "pop", "jazz"],
      artists: [],
      app: "poppy",
      lastfmClient: mockLastfmClient(),
    });

    // Alle 20 genres hebben weight > 0 (gekozen=1.0, rest=0.1)
    assert.equal(result.profile.meta.activeGenres, 20);
  });
});
