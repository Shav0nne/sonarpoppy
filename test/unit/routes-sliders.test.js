import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import slidersRouter from "../../routes/sliders.js";
import GenreSliders from "../../src/models/GenreSliders.js";
import { GENRES } from "../../src/config/genres.js";

let mongod, server, baseUrl;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());
  app.use("/api/sliders", slidersRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

beforeEach(async () => {
  await GenreSliders.deleteMany({});
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongod.stop();
});

// REQ-002: GET /api/sliders/:userId
describe("GET /api/sliders/:userId", () => {
  it("retourneert cold start defaults als geen document bestaat", async () => {
    const res = await fetch(`${baseUrl}/api/sliders/new-user`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(Object.keys(body.sliders).length, GENRES.length);
    for (const genre of GENRES) {
      assert.equal(body.sliders[genre], 1.0);
    }
    assert.deepEqual(body.locked, []);
    assert.equal(body.updatedAt, null);
  });

  it("retourneert bestaand document", async () => {
    const sliders = new Map();
    sliders.set("rock", 2.5);
    sliders.set("jazz", 0.3);
    await GenreSliders.create({ userId: "existing-user", sliders, locked: ["rock"] });

    const res = await fetch(`${baseUrl}/api/sliders/existing-user`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.sliders.rock, 2.5);
    assert.equal(body.sliders.jazz, 0.3);
    assert.deepEqual(body.locked, ["rock"]);
    assert.ok(body.updatedAt);
  });
});

// REQ-003: PUT /api/sliders/:userId
describe("PUT /api/sliders/:userId", () => {
  it("upsert: creëert document als het niet bestaat", async () => {
    const res = await fetch(`${baseUrl}/api/sliders/upsert-user`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sliders: { rock: 3.0 }, locked: ["jazz"] }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.sliders.rock, 3.0);
    assert.deepEqual(body.locked, ["jazz"]);
  });

  it("update: wijzigt bestaand document", async () => {
    await GenreSliders.create({ userId: "update-user" });
    const res = await fetch(`${baseUrl}/api/sliders/update-user`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sliders: { pop: 0.5 } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.sliders.pop, 0.5);
    // Andere genres behouden default
    assert.equal(body.sliders.rock, 1.0);
  });

  it("400 bij onbekende genre key", async () => {
    const res = await fetch(`${baseUrl}/api/sliders/bad-genre-user`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sliders: { "niet-bestaand": 1.0 } }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes("niet-bestaand"));
  });

  it("400 bij ongeldige locked genre", async () => {
    const res = await fetch(`${baseUrl}/api/sliders/bad-lock-user`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked: ["fake-genre"] }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes("fake-genre"));
  });
});

// REQ-004: POST /api/sliders/:userId/reset
describe("POST /api/sliders/:userId/reset", () => {
  it("reset naar equal weights en lege locked", async () => {
    const sliders = new Map();
    sliders.set("rock", 5.0);
    sliders.set("jazz", 0.1);
    await GenreSliders.create({ userId: "reset-user", sliders, locked: ["rock"] });

    const res = await fetch(`${baseUrl}/api/sliders/reset-user/reset`, {
      method: "POST",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    for (const genre of GENRES) {
      assert.equal(body.sliders[genre], 1.0);
    }
    assert.deepEqual(body.locked, []);
  });

  it("404 als geen bestaand document", async () => {
    const res = await fetch(`${baseUrl}/api/sliders/nonexistent/reset`, {
      method: "POST",
    });
    assert.equal(res.status, 404);
  });
});
