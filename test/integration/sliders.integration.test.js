import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import GenreSliders from "../../src/models/GenreSliders.js";
import { computeProfileVector } from "../../src/services/profile/computeProfile.js";
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

// Item I1: PUT sliders → profile compute via userId
describe("Item I1: PUT sliders → profile compute via userId", () => {
  it("computeProfileVector retourneert rock als topGenre bij rock=10, jazz=0.1", async () => {
    // (1) Maak GenreSliders document aan
    await GenreSliders.create({
      userId: "integration-test",
      sliders: { rock: 10.0, jazz: 0.1 },
    });

    // (2) Simuleer wat de profile route doet: haal op, converteer Map→Object, geef als weights
    const doc = await GenreSliders.findOne({ userId: "integration-test" });
    assert.ok(doc, "GenreSliders document moet bestaan");
    const weights = Object.fromEntries(doc.sliders);

    // (3) Roep computeProfileVector aan met de weights
    const { meta } = computeProfileVector(weights);

    // (4) Verifieer topGenre === 'rock'
    assert.equal(meta.topGenre, "rock", "topGenre moet rock zijn bij rock=10.0, jazz=0.1");

    // Cleanup
    await GenreSliders.deleteMany({ userId: "integration-test" });
  });
});

// Item I2: PUT + locked → reset → GET lifecycle
describe("Item I2: PUT + locked → reset → GET lifecycle", () => {
  it("na reset zijn alle sliders 1.0 en locked leeg", async () => {
    // (1) Maak document aan met rock=5.0, locked=['rock']
    await GenreSliders.create({
      userId: "lifecycle-test",
      sliders: { rock: 5.0 },
      locked: ["rock"],
    });

    // (2) Verifieer initiële state
    const doc1 = await GenreSliders.findOne({ userId: "lifecycle-test" });
    assert.ok(doc1, "Document moet bestaan");
    assert.equal(doc1.sliders.get("rock"), 5.0, "rock slider moet 5.0 zijn");
    assert.ok(doc1.locked.includes("rock"), "locked moet 'rock' bevatten");

    // (3) Reset: zet alle sliders naar 1.0 en locked naar []
    const resetSliders = new Map();
    for (const genre of GENRES) {
      resetSliders.set(genre, 1.0);
    }
    doc1.sliders = resetSliders;
    doc1.locked = [];
    await doc1.save();

    // (4) Verifieer reset state
    const doc2 = await GenreSliders.findOne({ userId: "lifecycle-test" });
    for (const genre of GENRES) {
      assert.equal(doc2.sliders.get(genre), 1.0, `${genre} moet 1.0 zijn na reset`);
    }
    assert.equal(doc2.locked.length, 0, "locked moet leeg zijn na reset");

    // Cleanup
    await GenreSliders.deleteMany({ userId: "lifecycle-test" });
  });
});
