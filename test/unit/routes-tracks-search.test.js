import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

let mockFind = async () => [];

mock.module("../../src/models/Track.js", {
  defaultExport: {
    find: (...args) => ({
      limit: () => ({ lean: () => mockFind(...args) }),
    }),
    distinct: () => Promise.resolve([]),
  },
});

mock.module("../../src/services/lastfm/client.js", {
  namedExports: {
    createLastfmClient: () => ({}),
  },
});

mock.module("../../src/services/spotify/client.js", {
  namedExports: {
    createSpotifyClient: () => null,
  },
});

mock.module("../../src/services/ingestion/ingest.js", {
  namedExports: {
    ingestTrack: async () => ({}),
    ingestBatch: async () => ({}),
  },
});

mock.module("../../src/services/spotify/enrichSpotify.js", {
  namedExports: {
    enrichTracks: async () => ({}),
  },
});

mock.module("../../src/services/cf/enrichCf.js", {
  namedExports: {
    enrichCfData: async () => ({}),
  },
});

const { default: tracksRouter } = await import("../../routes/tracks.js");

let server, baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/tracks", tracksRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  server?.close();
});

describe("GET /api/tracks/search", () => {
  it("retourneert 400 bij query < 2 chars", async () => {
    const res = await fetch(`${baseUrl}/api/tracks/search?q=a`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /2 characters/);
  });

  it("retourneert 400 bij ontbrekende query", async () => {
    const res = await fetch(`${baseUrl}/api/tracks/search`);
    assert.equal(res.status, 400);
  });

  it("zoekt op title en artist, retourneert { title, artist }", async () => {
    mockFind = async () => [
      { title: "Creep", artist: "Radiohead" },
      { title: "Karma Police", artist: "Radiohead" },
    ];

    const res = await fetch(`${baseUrl}/api/tracks/search?q=radio`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.results.length, 2);
    assert.deepEqual(body.results[0], { title: "Creep", artist: "Radiohead" });
  });

  it("retourneert lege array bij geen matches", async () => {
    mockFind = async () => [];

    const res = await fetch(`${baseUrl}/api/tracks/search?q=zznonexist`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.results, []);
  });
});
