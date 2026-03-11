import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "../../src/models/User.js";
import slidersRouter from "../../routes/sliders.js";
import blacklistRouter from "../../routes/blacklist.js";
import feedbackRouter from "../../routes/feedback.js";

let mongod, server, baseUrl;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());

  // Simulate JWT auth without fast path — middleware must do DB lookup
  app.use((req, _res, next) => {
    const userId = req.headers["x-user-id"];
    if (userId) req.user = { id: userId };
    next();
  });

  app.use("/api/v1/sliders", slidersRouter);
  app.use("/api/v1/blacklist", blacklistRouter);
  app.use("/api/v1/feedback", feedbackRouter);

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

describe("Onboarding guard blokkeert niet-onboarde users", () => {
  it("GET /sliders retourneert 403 als user onboarding niet heeft voltooid", async () => {
    const user = await User.create({
      username: "blocked_slider",
      email: "blocked_slider@test.com",
      password: "Password1!",
      hasCompletedOnboarding: false,
    });

    const res = await fetch(`${baseUrl}/api/v1/sliders`, {
      headers: { "X-User-Id": user._id.toString() },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Onboarding/);
  });

  it("POST /blacklist retourneert 403 als user onboarding niet heeft voltooid", async () => {
    const user = await User.create({
      username: "blocked_bl",
      email: "blocked_bl@test.com",
      password: "Password1!",
      hasCompletedOnboarding: false,
    });

    const res = await fetch(`${baseUrl}/api/v1/blacklist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": user._id.toString(),
      },
      body: JSON.stringify({ type: "artist", value: "Nickelback" }),
    });
    assert.equal(res.status, 403);
  });

  it("POST /feedback retourneert 403 als user onboarding niet heeft voltooid", async () => {
    const user = await User.create({
      username: "blocked_fb",
      email: "blocked_fb@test.com",
      password: "Password1!",
      hasCompletedOnboarding: false,
    });

    const trackId = new mongoose.Types.ObjectId().toString();
    const res = await fetch(`${baseUrl}/api/v1/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": user._id.toString(),
      },
      body: JSON.stringify({ trackId, action: "like" }),
    });
    assert.equal(res.status, 403);
  });

  it("GET /sliders retourneert 200 als user onboarding WEL heeft voltooid", async () => {
    const user = await User.create({
      username: "allowed_slider",
      email: "allowed_slider@test.com",
      password: "Password1!",
      hasCompletedOnboarding: true,
    });

    const res = await fetch(`${baseUrl}/api/v1/sliders`, {
      headers: { "X-User-Id": user._id.toString() },
    });
    assert.equal(res.status, 200);
  });

  it("401 zonder authenticatie op beschermde route", async () => {
    const res = await fetch(`${baseUrl}/api/v1/sliders`);
    assert.equal(res.status, 401);
  });
});
