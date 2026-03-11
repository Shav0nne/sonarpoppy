import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import profileRouter from "../../routes/profile.js";
import GenreSliders from "../../src/models/GenreSliders.js";

let mongod, server, baseUrl;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());

  // Test middleware that mimics authenticateJWT: reads userId from X-User-Id header
  app.use((req, _res, next) => {
    const userId = req.headers["x-user-id"];
    if (userId) req.user = { id: userId };
    next();
  });

  app.use("/api/profile", profileRouter);
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

describe("POST /api/profile/compute", () => {
  it("retourneert status 200", async () => {
    const res = await fetch(`${baseUrl}/api/profile/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weights: { rock: 5, pop: 3 } }),
    });
    assert.equal(res.status, 200);
  });

  it("retourneert vector als array van 20 floats", async () => {
    const res = await fetch(`${baseUrl}/api/profile/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weights: { rock: 5, pop: 3 } }),
    });
    const body = await res.json();
    assert.ok(Array.isArray(body.vector));
    assert.equal(body.vector.length, 20);
    assert.ok(body.vector.every((v) => typeof v === "number"));
  });

  it("retourneert meta met activeGenres en topGenre", async () => {
    const res = await fetch(`${baseUrl}/api/profile/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weights: { rock: 5, pop: 3 } }),
    });
    const body = await res.json();
    assert.ok(body.meta);
    assert.equal(typeof body.meta.activeGenres, "number");
    assert.equal(body.meta.topGenre, "rock");
  });

  it("cold start bij lege weights geeft equal distribution", async () => {
    const res = await fetch(`${baseUrl}/api/profile/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weights: {} }),
    });
    const body = await res.json();
    assert.equal(body.vector.length, 20);
    assert.equal(body.meta.activeGenres, 20);
    assert.equal(body.meta.topGenre, null);
  });

  it("bevat _links", async () => {
    const res = await fetch(`${baseUrl}/api/profile/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weights: { jazz: 1 } }),
    });
    const body = await res.json();
    assert.equal(body._links.self.href, "/api/profile/compute");
    assert.equal(body._links.recommendations.href, "/api/recommendations");
  });

  // REQ-006: JWT userId haalt sliders op als weights
  it("userId uit JWT haalt GenreSliders op als weights", async () => {
    const sliders = new Map();
    sliders.set("rock", 5.0);
    sliders.set("pop", 0.1);
    await GenreSliders.create({ userId: "slider-user", sliders });

    const res = await fetch(`${baseUrl}/api/profile/compute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "slider-user",
      },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.meta.topGenre, "rock");
  });

  it("JWT userId heeft voorrang boven weights", async () => {
    const sliders = new Map();
    sliders.set("jazz", 10.0);
    await GenreSliders.create({ userId: "priority-user", sliders });

    const res = await fetch(`${baseUrl}/api/profile/compute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "priority-user",
      },
      body: JSON.stringify({ weights: { rock: 10 } }),
    });
    const body = await res.json();
    // Jazz zou dominant moeten zijn (van sliders via JWT), niet rock (van weights)
    assert.equal(body.meta.topGenre, "jazz");
  });

  it("userId zonder document geeft cold start", async () => {
    const res = await fetch(`${baseUrl}/api/profile/compute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": "nonexistent-user",
      },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.meta.activeGenres, 20);
    assert.equal(body.meta.topGenre, null);
  });
});
