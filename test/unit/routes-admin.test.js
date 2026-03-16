import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import adminRouter from "../../routes/admin.js";
import AlgorithmConfig from "../../src/models/AlgorithmConfig.js";

let mongod, server, baseUrl;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());

  // Mimic authenticateJWT — set role via header
  app.use((req, _res, next) => {
    const role = req.headers["x-user-role"] || "user";
    const userId = req.headers["x-user-id"] || new mongoose.Types.ObjectId().toString();
    req.user = { id: userId, role };
    next();
  });

  app.use("/api/admin", adminRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

beforeEach(async () => {
  await AlgorithmConfig.deleteMany({});
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongod.stop();
});

const adminHeaders = {
  "X-User-Role": "admin",
  "X-User-Id": "admin-user-1",
  "Content-Type": "application/json",
};
const userHeaders = {
  "X-User-Role": "user",
  "Content-Type": "application/json",
};

// REQ-002: GET /api/admin/config
describe("GET /api/admin/config", () => {
  it("retourneert config met defaults bij eerste call", async () => {
    const res = await fetch(`${baseUrl}/api/admin/config`, { headers: adminHeaders });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.hybridWeights, { genre: 0.5, cf: 0.5 });
    assert.deepEqual(body.feedbackMultipliers, {
      like: 1.1,
      dislike: 0.5,
      library: 1.2,
      skip: 0.9,
    });
  });

  it("403 voor non-admin", async () => {
    const res = await fetch(`${baseUrl}/api/admin/config`, { headers: userHeaders });
    assert.equal(res.status, 403);
  });
});

// REQ-003: PATCH /api/admin/config
describe("PATCH /api/admin/config", () => {
  it("partial update — alleen meegegeven velden overschrijven", async () => {
    // Seed first
    await fetch(`${baseUrl}/api/admin/config`, { headers: adminHeaders });

    const res = await fetch(`${baseUrl}/api/admin/config`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ hybridWeights: { genre: 0.6, cf: 0.4 } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.hybridWeights, { genre: 0.6, cf: 0.4 });
    // Andere velden intact
    assert.deepEqual(body.feedbackMultipliers, {
      like: 1.1,
      dislike: 0.5,
      library: 1.2,
      skip: 0.9,
    });
  });

  it("400 bij ongeldige waarden", async () => {
    await fetch(`${baseUrl}/api/admin/config`, { headers: adminHeaders });

    const res = await fetch(`${baseUrl}/api/admin/config`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ hybridWeights: { genre: 0.3, cf: 0.3 } }),
    });
    assert.equal(res.status, 400);
  });

  it("400 bij lege body", async () => {
    const res = await fetch(`${baseUrl}/api/admin/config`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  it("403 voor non-admin", async () => {
    const res = await fetch(`${baseUrl}/api/admin/config`, {
      method: "PATCH",
      headers: userHeaders,
      body: JSON.stringify({ hybridWeights: { genre: 0.6, cf: 0.4 } }),
    });
    assert.equal(res.status, 403);
  });

  it("zet updatedBy uit JWT user", async () => {
    await fetch(`${baseUrl}/api/admin/config`, { headers: adminHeaders });

    const res = await fetch(`${baseUrl}/api/admin/config`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        feedbackMultipliers: { like: 1.3, dislike: 0.5, library: 1.2, skip: 0.9 },
      }),
    });
    const body = await res.json();
    assert.equal(body.updatedBy, "admin-user-1");
  });
});

// POST /api/admin/config/reset
describe("POST /api/admin/config/reset", () => {
  it("reset naar defaults", async () => {
    // Modify first
    await fetch(`${baseUrl}/api/admin/config`, { headers: adminHeaders });
    await fetch(`${baseUrl}/api/admin/config`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ hybridWeights: { genre: 0.7, cf: 0.3 } }),
    });

    const res = await fetch(`${baseUrl}/api/admin/config/reset`, {
      method: "POST",
      headers: adminHeaders,
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.hybridWeights, { genre: 0.5, cf: 0.5 });
  });

  it("403 voor non-admin", async () => {
    const res = await fetch(`${baseUrl}/api/admin/config/reset`, {
      method: "POST",
      headers: userHeaders,
    });
    assert.equal(res.status, 403);
  });
});
