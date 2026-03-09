import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import express from "express";
import Track from "../../src/models/Track.js";
import dialRouter from "../../routes/dial.js";
import recommendationsRouter from "../../routes/recommendations.js";

let mongoServer;
let server;
let baseUrl;

const v = (primary) => {
  const vec = new Array(20).fill(0);
  vec[primary] = 1;
  return vec;
};

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Track.syncIndexes();

  const app = express();
  app.use(express.json());
  app.use("/api/dial", dialRouter);
  app.use("/api/recommendations", recommendationsRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Track.deleteMany({});
});

// Item 2: Dial presets zijn read-only
describe("Item 2: Dial presets zijn read-only", () => {
  it("muteren van response JSON raakt server-state niet aan", async () => {
    // (1) GET /api/dial → ontvang presets
    const res1 = await fetch(`${baseUrl}/api/dial`);
    const body1 = await res1.json();
    assert.equal(res1.status, 200);
    const originalPresets = JSON.parse(JSON.stringify(body1.presets));

    // (2) Muteer een weight in de JSON response
    body1.presets[0].weights = { genre: 0.99, cf: 0.005, audio: 0.005 };
    body1.presets[1].name = "GEHACKT";

    // (3) GET /api/dial opnieuw
    const res2 = await fetch(`${baseUrl}/api/dial`);
    const body2 = await res2.json();
    assert.equal(res2.status, 200);

    // Verwacht: Presets in tweede request identiek aan eerste request
    assert.deepEqual(body2.presets, originalPresets);
  });
});

// Item I1: GET presets → POST met dial → verify weights matchen preset
describe("Item I1: GET presets → POST dial → weights match", () => {
  it("configuredWeights exact gelijk aan Stand 1 weights uit GET response", async () => {
    // Seed minimaal 1 track met genreVector
    await Track.create([{ title: "Rock Hit", artist: "A", genreVector: v(0) }]);

    // (1) GET /api/dial → haal Stand 1 preset op
    const dialRes = await fetch(`${baseUrl}/api/dial`);
    const dialBody = await dialRes.json();
    assert.equal(dialRes.status, 200);
    const stand1Preset = dialBody.presets.find((p) => p.position === 1);
    assert.ok(stand1Preset, "Stand 1 preset moet bestaan");

    // (2) POST /api/recommendations met { profileVector, dial: 1 }
    const recRes = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileVector: v(0), dial: 1 }),
    });
    const recBody = await recRes.json();
    assert.equal(recRes.status, 200);

    // (3) Vergelijk meta.configuredWeights met de weights uit de preset
    assert.deepEqual(
      recBody.meta.configuredWeights,
      stand1Preset.weights,
      "configuredWeights moet exact gelijk zijn aan Stand 1 weights",
    );
  });
});

// Item I2: POST met dial → POST met custom weights → verify dialPosition verschilt
describe("Item I2: dial vs custom weights → dialPosition", () => {
  it("dial=1 geeft dialPosition=1, custom weights geeft dialPosition=null", async () => {
    // Seed track
    await Track.create([{ title: "Pop Song", artist: "B", genreVector: v(1) }]);

    // (1) POST /api/recommendations met dial: 1
    const res1 = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileVector: v(1), dial: 1 }),
    });
    const body1 = await res1.json();
    assert.equal(res1.status, 200);
    assert.equal(body1.meta.dialPosition, 1, "Eerste request: dialPosition moet 1 zijn");

    // (2) POST /api/recommendations met custom weights
    const res2 = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileVector: v(1),
        weights: { genre: 0.5, cf: 0.2, audio: 0.3 },
      }),
    });
    const body2 = await res2.json();
    assert.equal(res2.status, 200);
    assert.equal(body2.meta.dialPosition, null, "Tweede request: dialPosition moet null zijn");
  });
});
