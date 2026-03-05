import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import genresRouter from "../../routes/genres.js";
import { GENRES } from "../../src/config/genres.js";

let server;
let baseUrl;

function createApp() {
  const app = express();
  app.use("/api/genres", genresRouter);
  return app;
}

before(async () => {
  const app = createApp();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => server?.close());

// REQ-001: GET /api/genres retourneert de 20 genres met index
describe("GET /api/genres", () => {
  it("retourneert status 200", async () => {
    const res = await fetch(`${baseUrl}/api/genres`);
    assert.equal(res.status, 200);
  });

  it("retourneert items array met 20 genres", async () => {
    const res = await fetch(`${baseUrl}/api/genres`);
    const body = await res.json();
    assert.equal(body.items.length, 20);
  });

  it("elk genre heeft index en name", async () => {
    const res = await fetch(`${baseUrl}/api/genres`);
    const body = await res.json();
    for (const item of body.items) {
      assert.ok("index" in item, "item moet index hebben");
      assert.ok("name" in item, "item moet name hebben");
      assert.equal(typeof item.index, "number");
      assert.equal(typeof item.name, "string");
    }
  });

  it("genre indices matchen GENRES array", async () => {
    const res = await fetch(`${baseUrl}/api/genres`);
    const body = await res.json();
    for (const item of body.items) {
      assert.equal(item.name, GENRES[item.index]);
    }
  });

  it("bevat _links.self", async () => {
    const res = await fetch(`${baseUrl}/api/genres`);
    const body = await res.json();
    assert.ok(body._links, "response moet _links bevatten");
    assert.ok(body._links.self, "response moet _links.self bevatten");
    assert.equal(body._links.self.href, "/api/genres");
  });
});
