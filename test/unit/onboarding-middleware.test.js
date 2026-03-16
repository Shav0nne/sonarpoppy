import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { requireOnboarding } from "../../src/middleware/onboardingMiddleware.js";
import User from "../../src/models/User.js";

let mongod, server, baseUrl;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());

  // Simulate JWT auth via X-User-Id header (no fast path — omit hasCompletedOnboarding)
  app.use((req, _res, next) => {
    const userId = req.headers["x-user-id"];
    if (userId) req.user = { id: userId };
    // If x-fast-path header is set, simulate fast path
    if (req.headers["x-fast-path"] === "true" && req.user) {
      req.user.hasCompletedOnboarding = true;
    }
    next();
  });

  app.use("/protected", requireOnboarding, (_req, res) => {
    res.json({ ok: true });
  });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

beforeEach(async () => {
  await User.deleteMany({});
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongod.stop();
});

describe("requireOnboarding middleware", () => {
  it("401 als req.user ontbreekt (geen JWT)", async () => {
    const res = await fetch(`${baseUrl}/protected`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.match(body.error, /Unauthorized/);
  });

  it("403 als user onboarding niet heeft voltooid", async () => {
    const user = await User.create({
      username: "notonboarded",
      email: "notonboarded@test.com",
      password: "Password1!",
      hasCompletedOnboarding: false,
    });

    const res = await fetch(`${baseUrl}/protected`, {
      headers: { "X-User-Id": user._id.toString() },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Onboarding/);
  });

  it("200 als user onboarding WEL heeft voltooid", async () => {
    const user = await User.create({
      username: "onboarded",
      email: "onboarded@test.com",
      password: "Password1!",
      hasCompletedOnboarding: true,
    });

    const res = await fetch(`${baseUrl}/protected`, {
      headers: { "X-User-Id": user._id.toString() },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
  });

  it("404 als user niet bestaat in DB", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await fetch(`${baseUrl}/protected`, {
      headers: { "X-User-Id": fakeId },
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.match(body.error, /not found/i);
  });

  it("fast path: skip DB lookup als hasCompletedOnboarding al true is", async () => {
    // Geen user in DB — maar fast path stuurt niet naar DB
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await fetch(`${baseUrl}/protected`, {
      headers: { "X-User-Id": fakeId, "X-Fast-Path": "true" },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
  });
});
