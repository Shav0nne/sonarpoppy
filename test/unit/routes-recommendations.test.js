import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

const v = (primary) => {
  const vec = new Array(20).fill(0);
  vec[primary] = 1;
  return vec;
};

const mockTracks = [
  { _id: "t1", title: "Rock Hit", artist: "A", genreVector: v(0) },
  { _id: "t2", title: "Pop Song", artist: "B", genreVector: v(1) },
  { _id: "t3", title: "Jazz Tune", artist: "C", genreVector: v(5) },
];

// Mock Track model to avoid MongoDB dependency
mock.module("../../src/models/Track.js", {
  defaultExport: {
    find: () => ({ lean: () => Promise.resolve(mockTracks) }),
  },
});

// Mock User model so requireOnboarding middleware doesn't try a real DB query
mock.module("../../src/models/User.js", {
  defaultExport: {
    findById: () => Promise.resolve({ hasCompletedOnboarding: true }),
  },
});

// Mock Feedback model
mock.module("../../src/models/Feedback.js", {
  defaultExport: {
    find: () => ({ lean: () => Promise.resolve([]) }),
  },
});

// Mock Blacklist model
mock.module("../../src/models/Blacklist.js", {
  defaultExport: {
    findOne: () => ({ lean: () => Promise.resolve(null) }),
  },
});

const { default: recommendationsRouter } = await import("../../routes/recommendations.js");

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  // Stub middleware: simulates JWT auth + completed onboarding
  app.use((req, _res, next) => {
    req.user = { id: "test-user", hasCompletedOnboarding: true };
    next();
  });
  app.use("/api/recommendations", recommendationsRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => server?.close());

// REQ-006: POST /api/recommendations retourneert aanbevolen tracks
describe("POST /api/recommendations", () => {
  const profileVector = v(0); // rock profiel

  it("retourneert status 200", async () => {
    const res = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileVector }),
    });
    assert.equal(res.status, 200);
  });

  it("retourneert tracks array gesorteerd op score", async () => {
    const res = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileVector }),
    });
    const body = await res.json();
    assert.ok(Array.isArray(body.tracks));
    assert.equal(body.tracks.length, 3);
    assert.ok(body.tracks[0].finalScore >= body.tracks[1].finalScore);
  });

  it("retourneert total count", async () => {
    const res = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileVector }),
    });
    const body = await res.json();
    assert.equal(body.total, 3);
  });

  it("retourneert meta met scoredAt, avgScore, scoreRange", async () => {
    const res = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileVector }),
    });
    const body = await res.json();
    assert.ok(body.meta);
    assert.ok(body.meta.scoredAt);
    assert.equal(typeof body.meta.avgScore, "number");
    assert.ok(body.meta.scoreRange);
  });

  it("respecteert limit parameter", async () => {
    const res = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileVector, limit: 1 }),
    });
    const body = await res.json();
    assert.equal(body.tracks.length, 1);
    assert.equal(body.total, 3);
  });

  it("retourneert 400 zonder profileVector", async () => {
    const res = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 5 }),
    });
    assert.equal(res.status, 400);
  });

  it("bevat _links", async () => {
    const res = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileVector }),
    });
    const body = await res.json();
    assert.equal(body._links.self.href, "/api/recommendations");
    assert.equal(body._links.profile.href, "/api/profile/compute");
  });
});
