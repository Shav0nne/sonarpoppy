import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import express from "express";
import Track from "../../src/models/Track.js";
import Feedback from "../../src/models/Feedback.js";
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
  if (mongoose.connection.collections.feedbacks) {
    await Feedback.deleteMany({});
  }
});

// Item 2: Dial presets zijn read-only
describe("Item 2: Dial presets zijn read-only", () => {
  it("muteren van response JSON raakt server-state niet aan", async () => {
    const res1 = await fetch(`${baseUrl}/api/dial`);
    const body1 = await res1.json();
    assert.equal(res1.status, 200);
    const originalPresets = JSON.parse(JSON.stringify(body1.presets));

    // Muteer filter en naam in de JSON response
    body1.presets[0].filter = { type: "none", threshold: null };
    body1.presets[1].name = "GEHACKT";

    const res2 = await fetch(`${baseUrl}/api/dial`);
    const body2 = await res2.json();
    assert.equal(res2.status, 200);
    assert.deepEqual(body2.presets, originalPresets);
  });
});

// Item I1: GET presets → POST met dial → verify bubbel-filter werkt
describe("Item I1: GET presets → POST dial → bubbel-filter actief", () => {
  it("Stand 1 filtert tracks met lage genreSim uit het resultaat", async () => {
    // Seed: 1 rock track (genreSim=1.0) + 1 pop track (genreSim=0)
    await Track.create([
      { title: "Rock Hit", artist: "A", genreVector: v(0) },
      { title: "Pop Song", artist: "B", genreVector: v(1) },
    ]);

    // GET presets → Stand 1 heeft minGenreSim filter
    const dialRes = await fetch(`${baseUrl}/api/dial`);
    const dialBody = await dialRes.json();
    assert.equal(dialRes.status, 200);
    const stand1 = dialBody.presets.find((p) => p.position === 1);
    assert.equal(stand1.filter.type, "minGenreSim");

    // POST recommendations met dial: 1 en rock profiel
    const recRes = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileVector: v(0), dial: 1 }),
    });
    const recBody = await recRes.json();
    assert.equal(recRes.status, 200);

    // Alleen Rock Hit (genreSim=1.0) komt erdoor, Pop Song (genreSim=0) niet
    assert.equal(recBody.tracks.length, 1);
    assert.equal(recBody.tracks[0].track.title, "Rock Hit");
  });
});

// Item I2: POST met dial → dialPosition in meta
describe("Item I2: dial parameter → dialPosition in meta", () => {
  it("dial=1 geeft dialPosition=1, default geeft dialPosition=3", async () => {
    await Track.create([{ title: "Pop Song", artist: "B", genreVector: v(1) }]);

    // POST met dial: 1
    const res1 = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileVector: v(1), dial: 1 }),
    });
    const body1 = await res1.json();
    assert.equal(res1.status, 200);
    assert.equal(body1.meta.dialPosition, 1);

    // POST zonder dial → default Stand 3
    const res2 = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileVector: v(1) }),
    });
    const body2 = await res2.json();
    assert.equal(res2.status, 200);
    assert.equal(body2.meta.dialPosition, 3);
  });
});

// Item I3: Stand 3 geen filter — alle tracks komen erdoor
describe("Item I3: Stand 3 geen filter", () => {
  it("Stand 3 retourneert alle tracks ongeacht genreSim", async () => {
    await Track.create([
      { title: "Rock Hit", artist: "A", genreVector: v(0) },
      { title: "Pop Song", artist: "B", genreVector: v(1) },
      { title: "Jazz Tune", artist: "C", genreVector: v(5) },
    ]);

    const res = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileVector: v(0), dial: 3 }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.tracks.length, 3);
  });
});
