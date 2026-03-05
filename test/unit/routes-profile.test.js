import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import profileRouter from "../../routes/profile.js";

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/profile", profileRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => server?.close());

// REQ-005: POST /api/profile/compute berekent profielvector uit genre weights
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
});
