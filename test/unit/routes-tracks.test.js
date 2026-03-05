import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

// Mock Track model
const mockTracks = [
  { _id: "t1", title: "Song A", artist: "Artist A", genreVector: new Array(20).fill(0.05) },
  { _id: "t2", title: "Song B", artist: "Artist B", genreVector: new Array(20).fill(0.1) },
];

let findResult = mockTracks;
let findOneResult = null;
let createResult = null;

mock.module("../../src/models/Track.js", {
  defaultExport: {
    find: () => ({ lean: () => Promise.resolve(findResult) }),
    findOne: () => Promise.resolve(findOneResult),
    create: (doc) => Promise.resolve({ _id: "new1", ...doc }),
  },
});

// Mock Last.fm client
mock.module("../../src/services/lastfm/client.js", {
  namedExports: {
    createLastfmClient: () => ({
      getTrackInfo: (artist, title) =>
        Promise.resolve({ artist, title, album: "Album", duration: 200000 }),
      getTrackTopTags: () =>
        Promise.resolve([
          { name: "rock", count: 100 },
          { name: "indie", count: 80 },
          { name: "alternative rock", count: 60 },
        ]),
      getArtistTopTags: () => Promise.resolve([{ name: "rock", count: 100 }]),
    }),
  },
});

const { default: tracksRouter } = await import("../../routes/tracks.js");

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/tracks", tracksRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => server?.close());

// REQ-002: GET /api/tracks retourneert alle tracks uit MongoDB
describe("GET /api/tracks", () => {
  beforeEach(() => {
    findResult = mockTracks;
  });

  it("retourneert status 200", async () => {
    const res = await fetch(`${baseUrl}/api/tracks`);
    assert.equal(res.status, 200);
  });

  it("retourneert items array met tracks", async () => {
    const res = await fetch(`${baseUrl}/api/tracks`);
    const body = await res.json();
    assert.ok(Array.isArray(body.items));
    assert.equal(body.items.length, 2);
  });

  it("bevat _links.self en _links.ingest", async () => {
    const res = await fetch(`${baseUrl}/api/tracks`);
    const body = await res.json();
    assert.equal(body._links.self.href, "/api/tracks");
    assert.equal(body._links.ingest.href, "/api/tracks/ingest");
  });

  it("retourneert lege array als geen tracks", async () => {
    findResult = [];
    const res = await fetch(`${baseUrl}/api/tracks`);
    const body = await res.json();
    assert.equal(body.items.length, 0);
  });
});

// REQ-003: POST /api/tracks/ingest verwerkt een enkele track via Last.fm
describe("POST /api/tracks/ingest", () => {
  beforeEach(() => {
    findOneResult = null;
  });

  it("retourneert 201 bij created", async () => {
    const res = await fetch(`${baseUrl}/api/tracks/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artist: "Radiohead", title: "Creep" }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, "created");
  });

  it("retourneert 200 bij skipped (bestaande track)", async () => {
    findOneResult = { _id: "existing", artist: "Radiohead", title: "Creep" };
    const res = await fetch(`${baseUrl}/api/tracks/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artist: "Radiohead", title: "Creep" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "skipped");
  });

  it("retourneert 400 zonder artist/title", async () => {
    const res = await fetch(`${baseUrl}/api/tracks/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artist: "Radiohead" }),
    });
    assert.equal(res.status, 400);
  });

  it("bevat _links in response", async () => {
    const res = await fetch(`${baseUrl}/api/tracks/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artist: "Radiohead", title: "Creep" }),
    });
    const body = await res.json();
    assert.ok(body._links);
    assert.equal(body._links.self.href, "/api/tracks/ingest");
    assert.equal(body._links.tracks.href, "/api/tracks");
  });
});

// REQ-004: POST /api/tracks/ingest-batch verwerkt meerdere tracks
describe("POST /api/tracks/ingest-batch", () => {
  beforeEach(() => {
    findOneResult = null;
  });

  it("retourneert status 200", async () => {
    const res = await fetch(`${baseUrl}/api/tracks/ingest-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracks: [
          { artist: "A", title: "Song A" },
          { artist: "B", title: "Song B" },
        ],
      }),
    });
    assert.equal(res.status, 200);
  });

  it("retourneert results array en summary", async () => {
    const res = await fetch(`${baseUrl}/api/tracks/ingest-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracks: [{ artist: "A", title: "Song A" }],
      }),
    });
    const body = await res.json();
    assert.ok(Array.isArray(body.results));
    assert.ok(body.summary);
    assert.ok("created" in body.summary);
    assert.ok("skipped" in body.summary);
    assert.ok("failed" in body.summary);
  });

  it("retourneert 400 zonder tracks array", async () => {
    const res = await fetch(`${baseUrl}/api/tracks/ingest-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artist: "oops" }),
    });
    assert.equal(res.status, 400);
  });

  it("bevat _links in response", async () => {
    const res = await fetch(`${baseUrl}/api/tracks/ingest-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracks: [{ artist: "A", title: "Song A" }],
      }),
    });
    const body = await res.json();
    assert.ok(body._links);
    assert.equal(body._links.self.href, "/api/tracks/ingest-batch");
  });
});
