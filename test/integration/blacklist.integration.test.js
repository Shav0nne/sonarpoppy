import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import http from "node:http";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";

import blacklistRouter from "../../routes/blacklist.js";
import Blacklist from "../../src/models/Blacklist.js";
import Track from "../../src/models/Track.js";
import { getRecommendations } from "../../src/services/recommendation/recommend.js";
import { GENRE_COUNT, genreNameToIndex } from "../../src/config/genres.js";

let mongoServer;
let server;
let baseUrl;

const userId = "integration-user-123";

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

  // Test middleware: reads userId from X-User-Id header to simulate JWT + completed onboarding
  app.use((req, _res, next) => {
    const uid = req.headers["x-user-id"];
    if (uid) req.user = { id: uid, hasCompletedOnboarding: true };
    next();
  });

  app.use("/api/blacklist", blacklistRouter);
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

describe("Blacklist Integration", () => {
  describe("API Endpoints", () => {
    it("POST /api/blacklist should add entry", async () => {
      const res = await fetch(`${baseUrl}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ type: "artist", value: "Taylor Swift" }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.userId, userId);
      assert.strictEqual(data.entries.length, 1);
      assert.strictEqual(data.entries[0].type, "artist");
      assert.strictEqual(data.entries[0].value, "Taylor Swift");
      assert.ok(data._links);
    });

    it("POST /api/blacklist should reject duplicates", async () => {
      await fetch(`${baseUrl}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ type: "genre", value: "rock" }),
      });

      const res = await fetch(`${baseUrl}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ type: "genre", value: "rock" }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 409);
      assert.strictEqual(data.error, "Entry already exists in blacklist");
    });

    it("POST /api/blacklist should resolve genre aliases", async () => {
      const res = await fetch(`${baseUrl}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ type: "genre", value: "classic rock" }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.entries[0].value, "rock");
    });

    it("GET /api/blacklist should return entries", async () => {
      await Blacklist.create({ userId, entries: [{ type: "track", value: "t1" }] });

      const res = await fetch(`${baseUrl}/api/blacklist`, {
        headers: { "X-User-Id": userId },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.userId, userId);
      assert.strictEqual(data.entries.length, 1);
      assert.strictEqual(data.entries[0].value, "t1");
    });

    it("DELETE /api/blacklist/:entryId should remove entry", async () => {
      const doc = await Blacklist.create({
        userId,
        entries: [
          { type: "track", value: "t1" },
          { type: "track", value: "t2" },
        ],
      });

      const entryId = doc.entries[0]._id.toString();

      const res = await fetch(`${baseUrl}/api/blacklist/${entryId}`, {
        method: "DELETE",
        headers: { "X-User-Id": userId },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.userId, userId);
      assert.strictEqual(data.entries.length, 1);
      assert.strictEqual(data.entries[0].value, "t2");
      assert.ok(data._links);
    });

    it("GET /api/blacklist should return empty entries when no blacklist exists", async () => {
      const res = await fetch(`${baseUrl}/api/blacklist`, {
        headers: { "X-User-Id": "nonexistent-user" },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.userId, "nonexistent-user");
      assert.deepStrictEqual(data.entries, []);
      assert.ok(data._links);
    });

    it("POST /api/blacklist should reject missing type", async () => {
      const res = await fetch(`${baseUrl}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ value: "track-abc" }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.error, "Type and value are required");
    });

    it("POST /api/blacklist should reject missing value", async () => {
      const res = await fetch(`${baseUrl}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ type: "artist" }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.error, "Type and value are required");
    });

    it("POST /api/blacklist should reject invalid genre name", async () => {
      const res = await fetch(`${baseUrl}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ type: "genre", value: "brostep" }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 400);
      assert.match(data.error, /Invalid genre/);
    });

    it("POST /api/blacklist should reject case-insensitive artist duplicate", async () => {
      await fetch(`${baseUrl}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ type: "artist", value: "Radiohead" }),
      });

      const res = await fetch(`${baseUrl}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ type: "artist", value: "radiohead" }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 409);
      assert.strictEqual(data.error, "Entry already exists in blacklist");
    });

    it("POST /api/blacklist should reject case-insensitive track duplicate", async () => {
      await fetch(`${baseUrl}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ type: "track", value: "Bohemian Rhapsody" }),
      });

      const res = await fetch(`${baseUrl}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ type: "track", value: "bohemian rhapsody" }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 409);
      assert.strictEqual(data.error, "Entry already exists in blacklist");
    });

    it("POST /api/blacklist should reject genre alias duplicate", async () => {
      await fetch(`${baseUrl}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ type: "genre", value: "rock" }),
      });

      const res = await fetch(`${baseUrl}/api/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({ type: "genre", value: "classic rock" }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 409);
      assert.strictEqual(data.error, "Entry already exists in blacklist");
    });

    it("DELETE /api/blacklist/:entryId should 404 when no blacklist exists", async () => {
      const res = await fetch(`${baseUrl}/api/blacklist/507f1f77bcf86cd799439011`, {
        method: "DELETE",
        headers: { "X-User-Id": "ghost-user" },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 404);
      assert.strictEqual(data.error, "Blacklist not found for user");
    });

    it("DELETE /api/blacklist/:entryId should 404 for non-existent entryId", async () => {
      await Blacklist.create({ userId, entries: [{ type: "track", value: "t1" }] });

      const res = await fetch(`${baseUrl}/api/blacklist/507f1f77bcf86cd799439011`, {
        method: "DELETE",
        headers: { "X-User-Id": userId },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 404);
      assert.strictEqual(data.error, "Entry not found in blacklist");
    });
  });

  describe("Recommendation Pipeline Rules", () => {
    it("should filter out tracks and artists pre-score, and genres post-score", async () => {
      const t1 = await Track.create({
        title: "Banned Track",
        artist: "Cool Band",
        genreVector: createVector({ pop: 0.9 }),
      });
      const t2 = await Track.create({
        title: "Good Track",
        artist: "Banned Artist",
        genreVector: createVector({ pop: 0.9 }),
      });
      const t3 = await Track.create({
        title: "Bad Genre",
        artist: "Cool Band",
        genreVector: createVector({ rock: 0.9 }),
      });
      const t4 = await Track.create({
        title: "Great Track",
        artist: "Cool Band",
        genreVector: createVector({ pop: 0.9 }),
      });

      await Blacklist.create({
        userId,
        entries: [
          { type: "track", value: t1._id.toString() },
          { type: "artist", value: "Banned Artist" },
          { type: "genre", value: "rock" },
        ],
      });

      const profileVector = createVector({ pop: 0.8, rock: 0.8 });
      const result = await getRecommendations({ profileVector, userId });

      assert.strictEqual(result.tracks.length, 1);
      assert.strictEqual(result.tracks[0].track._id.toString(), t4._id.toString());
      assert.strictEqual(result.tracks[0].track.title, "Great Track");
    });

    it("should return all tracks when no blacklist exists for user", async () => {
      await Track.create({ title: "T1", artist: "A1", genreVector: createVector({ rock: 0.9 }) });
      await Track.create({ title: "T2", artist: "A2", genreVector: createVector({ pop: 0.9 }) });
      await Track.create({ title: "T3", artist: "A3", genreVector: createVector({ jazz: 0.9 }) });

      const result = await getRecommendations({
        profileVector: createVector({ rock: 0.8 }),
        userId: "user-without-blacklist",
      });
      assert.strictEqual(result.total, 3);
    });

    it("should not leak blacklist between users", async () => {
      const t1 = await Track.create({
        title: "Banned For A",
        artist: "Artist X",
        genreVector: createVector({ pop: 0.9 }),
      });
      await Track.create({
        title: "Safe Track",
        artist: "Artist Y",
        genreVector: createVector({ pop: 0.9 }),
      });

      await Blacklist.create({
        userId: "userA",
        entries: [{ type: "track", value: t1._id.toString() }],
      });

      const profileVector = createVector({ pop: 0.8 });
      const resultA = await getRecommendations({ profileVector, userId: "userA" });
      const resultB = await getRecommendations({ profileVector, userId: "userB" });

      assert.strictEqual(resultA.total, 1);
      assert.strictEqual(resultB.total, 2);
    });

    it("should filter dominant genre below 0.4 threshold", async () => {
      await Track.create({
        title: "Low Metal",
        artist: "Band A",
        genreVector: createVector({ metal: 0.35, rock: 0.3 }),
      });
      await Track.create({
        title: "Safe Pop",
        artist: "Band B",
        genreVector: createVector({ pop: 0.9 }),
      });

      await Blacklist.create({ userId, entries: [{ type: "genre", value: "metal" }] });

      const result = await getRecommendations({
        profileVector: createVector({ metal: 0.5, pop: 0.5 }),
        userId,
      });
      assert.strictEqual(result.total, 1);
      assert.strictEqual(result.tracks[0].track.title, "Safe Pop");
    });

    it("should filter non-dominant genre via threshold path (>= 0.4)", async () => {
      await Track.create({
        title: "Multi-Genre",
        artist: "Band A",
        genreVector: createVector({ pop: 0.8, rock: 0.5 }),
      });
      await Track.create({
        title: "Pure Pop",
        artist: "Band B",
        genreVector: createVector({ pop: 0.9 }),
      });

      await Blacklist.create({ userId, entries: [{ type: "genre", value: "rock" }] });

      const result = await getRecommendations({
        profileVector: createVector({ pop: 0.9 }),
        userId,
      });
      assert.strictEqual(result.total, 1);
      assert.strictEqual(result.tracks[0].track.title, "Pure Pop");
    });
  });
});
