import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

let mockGetArtistImage = async () => null;

mock.module("../../src/services/artists/artistImageService.js", {
  namedExports: {
    getArtistImage: (...args) => mockGetArtistImage(...args),
  },
});

mock.module("../../src/services/lastfm/client.js", {
  namedExports: {
    createLastfmClient: () => ({}),
  },
});

const { default: artistsRouter } = await import("../../routes/artists.js");

let server, baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/artists", artistsRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  server?.close();
});

describe("GET /api/artists/:name/image", () => {
  it("retourneert 200 met artist images", async () => {
    mockGetArtistImage = async () => ({
      artist: "radiohead",
      images: [
        { url: "https://img.fm/small.jpg", size: "small" },
        { url: "https://img.fm/large.jpg", size: "large" },
      ],
      fetchedAt: new Date("2026-03-16T12:00:00Z"),
    });

    const res = await fetch(`${baseUrl}/api/artists/Radiohead/image`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.artist, "radiohead");
    assert.equal(body.images.length, 2);
    assert.equal(body.images[0].url, "https://img.fm/small.jpg");
    assert.equal(body.images[0].size, "small");
    assert.ok(body.fetchedAt);
  });

  it("retourneert 404 als artist niet gevonden", async () => {
    mockGetArtistImage = async () => null;

    const res = await fetch(`${baseUrl}/api/artists/NonExistent12345/image`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.error, "Artist not found");
  });

  it("decodeert URL-encoded artist namen", async () => {
    let receivedName = null;
    mockGetArtistImage = async (name) => {
      receivedName = name;
      return {
        artist: "the rolling stones",
        images: [{ url: "https://img.fm/small.jpg", size: "small" }],
        fetchedAt: new Date(),
      };
    };

    const res = await fetch(`${baseUrl}/api/artists/The%20Rolling%20Stones/image`);
    assert.equal(res.status, 200);
    assert.equal(receivedName, "The Rolling Stones");
  });
});
