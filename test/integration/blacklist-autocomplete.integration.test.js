// Run with: LASTFM_API_KEY=test-dummy-key node --test test/integration/blacklist-autocomplete.integration.test.js
// The artists router creates a lastfm client at import time; the dummy key prevents the throw.
// Last.fm calls gracefully fail, so only DB artists are returned in search results.
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import http from "node:http";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";

import blacklistRouter from "../../routes/blacklist.js";
import artistsRouter from "../../routes/artists.js";
import Blacklist from "../../src/models/Blacklist.js";
import Track from "../../src/models/Track.js";
import { GENRE_COUNT, genreNameToIndex } from "../../src/config/genres.js";

let mongoServer;
let server;
let baseUrl;

const userId = "integration-autocomplete-user";

function createVector(nameValPairs) {
  const v = new Array(GENRE_COUNT).fill(0);
  for (const [name, val] of Object.entries(nameValPairs)) {
    const idx = genreNameToIndex(name);
    if (idx !== null) v[idx] = val;
  }
  return v;
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const app = express();
  app.use(express.json());

  // Simulate auth: inject user from X-User-Id header with onboarding completed
  app.use((req, _res, next) => {
    const uid = req.headers["x-user-id"];
    if (uid) req.user = { id: uid, hasCompletedOnboarding: true };
    next();
  });

  app.use("/api/v1/blacklist", blacklistRouter);
  app.use("/api/v1/artists", artistsRouter);

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
  await Blacklist.deleteMany({});
  await Track.deleteMany({});
});

describe("Blacklist Autocomplete Integration", () => {
  it("Search → blacklist add → case-variant duplicate reject flow", async () => {
    // 1. Setup: create track with artist "Radiohead"
    await Track.create({
      title: "Creep",
      artist: "Radiohead",
      genreVector: createVector({ rock: 0.9 }),
    });

    // 2. GET /api/v1/artists/search?q=ra → expect results containing "Radiohead"
    const searchRes = await fetch(`${baseUrl}/api/v1/artists/search?q=ra`, {
      headers: { "X-User-Id": userId },
    });
    assert.equal(searchRes.status, 200);

    const searchData = await searchRes.json();
    assert.ok(Array.isArray(searchData.results), "results should be an array");

    const radioheadResult = searchData.results.find((r) => r.name.toLowerCase() === "radiohead");
    assert.ok(radioheadResult, "Search results should contain Radiohead");

    // 3. POST /api/v1/blacklist with Radiohead → expect 201
    const addRes = await fetch(`${baseUrl}/api/v1/blacklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId },
      body: JSON.stringify({ type: "artist", value: "Radiohead" }),
    });
    assert.equal(addRes.status, 201);

    const addData = await addRes.json();
    assert.equal(addData.entries.length, 1);
    assert.equal(addData.entries[0].type, "artist");
    assert.equal(addData.entries[0].value, "Radiohead");

    // 4. POST /api/v1/blacklist with case-variant "radiohead" → expect 409
    const dupRes = await fetch(`${baseUrl}/api/v1/blacklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": userId },
      body: JSON.stringify({ type: "artist", value: "radiohead" }),
    });
    assert.equal(dupRes.status, 409);

    const dupData = await dupRes.json();
    assert.equal(dupData.error, "Entry already exists in blacklist");
  });
});
