import { after, before, describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import GenreSliders from "../../src/models/GenreSliders.js";
import User from "../../src/models/User.js";
import { processOnboarding } from "../../src/services/onboarding/onboard.js";
import { GENRES } from "../../src/config/genres.js";

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await GenreSliders.syncIndexes();
  await User.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await GenreSliders.deleteMany({});
  await User.deleteMany({});
});

function mockLastfmClient(tagMap = {}) {
  return {
    getArtistTopTags: async (artist) => tagMap[artist] || [],
  };
}

// Helper: maak een echte DB user aan en geef het _id als string terug
async function createUser(overrides = {}) {
  const user = await User.create({
    username: `user_${Math.random().toString(36).slice(2)}`,
    email: `test_${Math.random().toString(36).slice(2)}@test.com`,
    password: "Password1!",
    ...overrides,
  });
  return user._id.toString();
}

// REQ-001: processOnboarding retourneert profiel met vector + meta + sliders
describe("REQ-001: processOnboarding orchestratie", () => {
  it("retourneert profile met vector (20 floats) en meta + sliders", async () => {
    const userId = await createUser();
    const result = await processOnboarding({
      userId,
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
    const userId = await createUser();
    await processOnboarding({
      userId,
      genres: ["rock", "pop", "jazz"],
      artists: [],
      app: "poppy",
      lastfmClient: mockLastfmClient(),
    });

    const doc = await GenreSliders.findOne({ userId });
    assert.ok(doc, "GenreSliders document moet bestaan");
    assert.equal(doc.sliders.get("rock"), 1.0);
    assert.equal(doc.sliders.get("pop"), 1.0);
    assert.equal(doc.sliders.get("jazz"), 1.0);
  });

  it("overschrijft weights bij herhaalde onboarding", async () => {
    const userId = await createUser();

    await processOnboarding({
      userId,
      genres: ["rock", "pop", "jazz"],
      artists: [],
      app: "poppy",
      lastfmClient: mockLastfmClient(),
    });

    await processOnboarding({
      userId,
      genres: ["electronic", "ambient", "dance"],
      artists: [],
      app: "poppy",
      lastfmClient: mockLastfmClient(),
    });

    const doc = await GenreSliders.findOne({ userId });
    assert.equal(doc.sliders.get("electronic"), 1.0, "electronic moet 1.0 zijn");
    assert.equal(doc.sliders.get("rock"), 0.1, "rock moet teruggevallen zijn naar 0.1");
  });
});

// INT-1: Cross-requirement integratie (genres + artist boost + upsert output)
describe("INT-1: volledige keten genres → artist boost → upsert → profile", () => {
  it("gekozen genres=1.0, artiest-boosted genre > 0.1, GenreSliders correct", async () => {
    const userId = await createUser();
    const client = mockLastfmClient({
      "Daft Punk": [
        { name: "electronic", count: 100 },
        { name: "dance", count: 80 },
      ],
    });

    const result = await processOnboarding({
      userId,
      genres: ["rock", "pop", "jazz"],
      artists: ["Radiohead", "Daft Punk", "Miles Davis"],
      app: "sonarpop",
      lastfmClient: client,
    });

    assert.equal(result.sliders.rock, 1.0, "rock moet 1.0 zijn");
    assert.equal(result.sliders.pop, 1.0, "pop moet 1.0 zijn");
    assert.equal(result.sliders.jazz, 1.0, "jazz moet 1.0 zijn");

    assert.ok(
      result.sliders.electronic > 0.1,
      `electronic moet > 0.1 zijn (got ${result.sliders.electronic})`,
    );

    const doc = await GenreSliders.findOne({ userId });
    assert.ok(doc, "GenreSliders document moet bestaan");
    assert.equal(doc.sliders.get("rock"), 1.0);
    assert.equal(doc.sliders.get("electronic"), result.sliders.electronic);

    assert.equal(result.profile.vector.length, 20);
    assert.ok(result.profile.meta.topGenre, "moet topGenre hebben");

    // Controleer dat hasCompletedOnboarding op true is gezet
    const user = await User.findById(userId);
    assert.equal(user.hasCompletedOnboarding, true, "hasCompletedOnboarding moet true zijn");
  });
});

// REQ-006: Profile vector consistent met weights
describe("REQ-006: Profile response consistent met weights", () => {
  it("topGenre komt overeen met hoogste weight", async () => {
    const userId = await createUser();
    const result = await processOnboarding({
      userId,
      genres: ["rock", "pop", "jazz"],
      artists: [],
      app: "poppy",
      lastfmClient: mockLastfmClient(),
    });

    const topGenres = ["rock", "pop", "jazz"];
    assert.ok(
      topGenres.includes(result.profile.meta.topGenre),
      `topGenre should be one of ${topGenres}, got ${result.profile.meta.topGenre}`,
    );
  });

  it("activeGenres telt genres met weight > 0", async () => {
    const userId = await createUser();
    const result = await processOnboarding({
      userId,
      genres: ["rock", "pop", "jazz"],
      artists: [],
      app: "poppy",
      lastfmClient: mockLastfmClient(),
    });

    // Alle 20 genres hebben weight > 0 (gekozen=1.0, rest=0.1)
    assert.equal(result.profile.meta.activeGenres, 20);
  });
});
