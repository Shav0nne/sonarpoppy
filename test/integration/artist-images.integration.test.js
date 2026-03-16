import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { getArtistImage } from "../../src/services/artists/artistImageService.js";
import ArtistImage from "../../src/models/ArtistImage.js";

let mongoServer;

const ARTIST_INFO = {
  name: "Radiohead",
  images: [
    { url: "https://img.fm/small.jpg", size: "small" },
    { url: "https://img.fm/large.jpg", size: "large" },
  ],
};

function createMockClient() {
  let callCount = 0;
  return {
    getArtistInfo: async () => {
      callCount++;
      return ARTIST_INFO;
    },
    getCallCount: () => callCount,
  };
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await ArtistImage.deleteMany({});
});

describe("Artist Images Integration — cache hit (Item 2)", () => {
  it("tweede request komt uit DB, geen extra Last.fm call", async () => {
    const client = createMockClient();

    // Eerste request: cache miss → Last.fm fetch → DB save
    const first = await getArtistImage("Radiohead", client);
    assert.equal(first.artist, "radiohead");
    assert.equal(first.images.length, 2);
    assert.equal(client.getCallCount(), 1);

    // Tweede request: cache hit → uit DB
    const second = await getArtistImage("Radiohead", client);
    assert.equal(second.artist, "radiohead");
    assert.equal(second.images.length, 2);
    assert.equal(second.images[0].url, first.images[0].url);
    assert.equal(client.getCallCount(), 1, "Last.fm mag niet opnieuw aangeroepen worden");
  });
});

describe("Artist Images Integration — case-insensitive lookup (Item 4)", () => {
  it("RADIOHEAD en radiohead retourneren dezelfde data, 1 DB record", async () => {
    const client = createMockClient();

    // Request met uppercase
    const upper = await getArtistImage("RADIOHEAD", client);
    assert.equal(upper.artist, "radiohead");

    // Request met lowercase
    const lower = await getArtistImage("radiohead", client);
    assert.equal(lower.artist, "radiohead");
    assert.equal(lower.images[0].url, upper.images[0].url);

    // Slechts 1 DB record
    const count = await ArtistImage.countDocuments({});
    assert.equal(count, 1, "Er mag maar 1 DB record zijn");
  });
});

describe("Artist Images Integration — cache + casing (Item 6)", () => {
  it("RADIOHEAD cache miss, radiohead cache hit, 1 DB record, geen extra Last.fm call", async () => {
    const client = createMockClient();

    // Eerste request: "RADIOHEAD" → cache miss
    const first = await getArtistImage("RADIOHEAD", client);
    assert.equal(first.artist, "radiohead");
    assert.equal(client.getCallCount(), 1);

    // Tweede request: "radiohead" → cache hit via case-insensitive match
    const second = await getArtistImage("radiohead", client);
    assert.equal(second.artist, "radiohead");
    assert.equal(second.images[0].url, first.images[0].url);
    assert.equal(client.getCallCount(), 1, "Geen extra Last.fm call bij cache hit");

    // 1 DB record
    const count = await ArtistImage.countDocuments({});
    assert.equal(count, 1, "Slechts 1 DB record aangemaakt");
  });
});
