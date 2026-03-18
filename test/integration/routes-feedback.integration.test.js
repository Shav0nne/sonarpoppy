import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import feedbackRouter from "../../routes/feedback.js";
import Feedback from "../../src/models/Feedback.js";

let mongod, server, baseUrl;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());
  
  // Simple stub for authenticated user
  app.use((req, res, next) => {
    req.user = { id: "test-user-id", hasCompletedOnboarding: true };
    next();
  });

  app.use("/api/v1/feedback", feedbackRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

beforeEach(async () => {
  await Feedback.deleteMany({});
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongod.stop();
});

const headers = { "Content-Type": "application/json" };

describe("Feedback Routes (Simplified Integration)", () => {
  it("GET /api/v1/feedback retourneert alle feedback voor de JWT user", async () => {
    const trackId = new mongoose.Types.ObjectId();
    await Feedback.create({ userId: "test-user-id", trackId, action: "like" });
    await Feedback.create({ userId: "other-user", trackId, action: "dislike" });

    const res = await fetch(`${baseUrl}/api/v1/feedback`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.length, 1);
    assert.equal(body[0].userId, "test-user-id");
  });

  it("POST /api/v1/feedback maakt feedback aan", async () => {
    const trackId = new mongoose.Types.ObjectId().toString();
    const res = await fetch(`${baseUrl}/api/v1/feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify({ trackId, action: "like" })
    });
    assert.equal(res.status, 201);
    const doc = await Feedback.findOne({ userId: "test-user-id", trackId });
    assert.ok(doc);
    assert.equal(doc.action, "like");
  });

  it("GET /api/v1/feedback/:trackId retourneert specifieke feedback", async () => {
    const trackId = new mongoose.Types.ObjectId().toString();
    await Feedback.create({ userId: "test-user-id", trackId, action: "like" });

    const res = await fetch(`${baseUrl}/api/v1/feedback/${trackId}`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.trackId, trackId);
  });

  it("DELETE /api/v1/feedback/:trackId verwijdert feedback", async () => {
    const trackId = new mongoose.Types.ObjectId().toString();
    await Feedback.create({ userId: "test-user-id", trackId, action: "like" });

    const res = await fetch(`${baseUrl}/api/v1/feedback/${trackId}`, {
      method: "DELETE",
      headers
    });
    assert.equal(res.status, 204);

    const doc = await Feedback.findOne({ userId: "test-user-id", trackId });
    assert.equal(doc, null);
  });

  it("POST /api/v1/feedback/:trackId/play incrementer playCount", async () => {
    const trackId = new mongoose.Types.ObjectId().toString();
    
    const res1 = await fetch(`${baseUrl}/api/v1/feedback/${trackId}/play`, {
      method: "POST",
      headers
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.playCount, 1);

    const res2 = await fetch(`${baseUrl}/api/v1/feedback/${trackId}/play`, {
      method: "POST",
      headers
    });
    const body2 = await res2.json();
    assert.equal(body2.playCount, 2);
  });
});
