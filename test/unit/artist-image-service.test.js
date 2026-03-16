import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getArtistImage } from "../../src/services/artists/artistImageService.js";

function createMockDb(stored = null) {
  let saved = stored;
  return {
    findOne: async (query) => {
      if (saved && saved.artist === query.artist) return saved;
      return null;
    },
    findOneAndUpdate: async (_filter, update, _opts) => {
      saved = { ...update.$set };
      return saved;
    },
    getSaved: () => saved,
  };
}

function createMockClient(artistInfo) {
  let callCount = 0;
  return {
    getArtistInfo: async () => {
      callCount++;
      return artistInfo;
    },
    getCallCount: () => callCount,
  };
}

const ARTIST_INFO = {
  name: "Radiohead",
  images: [
    { url: "https://img.fm/small.jpg", size: "small" },
    { url: "https://img.fm/large.jpg", size: "large" },
  ],
  mbid: "abc-123",
  url: "https://last.fm/radiohead",
};

describe("getArtistImage — cache miss (REQ-004)", () => {
  it("fetcht van Last.fm bij eerste request en slaat op", async () => {
    const db = createMockDb();
    const client = createMockClient(ARTIST_INFO);

    const result = await getArtistImage("Radiohead", client, { db });

    assert.equal(result.artist, "radiohead");
    assert.equal(result.images.length, 2);
    assert.equal(result.images[0].url, "https://img.fm/small.jpg");
    assert.ok(result.fetchedAt instanceof Date);
    assert.equal(client.getCallCount(), 1);
  });

  it("retourneert null als artist niet gevonden op Last.fm", async () => {
    const db = createMockDb();
    const client = {
      getArtistInfo: async () => {
        const err = new Error("Artist not found");
        err.name = "LastfmNotFoundError";
        throw err;
      },
    };

    const result = await getArtistImage("NonExistent", client, { db });
    assert.equal(result, null);
  });
});

describe("getArtistImage — cache hit (REQ-004)", () => {
  it("retourneert uit DB zonder Last.fm aan te roepen bij vers record", async () => {
    const cached = {
      artist: "radiohead",
      images: [{ url: "https://img.fm/small.jpg", size: "small" }],
      fetchedAt: new Date(), // vers
    };
    const db = createMockDb(cached);
    const client = createMockClient(ARTIST_INFO);

    const result = await getArtistImage("Radiohead", client, { db });

    assert.equal(result.artist, "radiohead");
    assert.equal(result.images.length, 1);
    assert.equal(client.getCallCount(), 0);
  });
});

describe("getArtistImage — staleness check (REQ-005)", () => {
  it("re-fetcht als fetchedAt ouder is dan TTL", async () => {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 31); // 31 dagen oud

    const cached = {
      artist: "radiohead",
      images: [{ url: "https://img.fm/old.jpg", size: "small" }],
      fetchedAt: staleDate,
    };
    const db = createMockDb(cached);
    const client = createMockClient(ARTIST_INFO);

    const result = await getArtistImage("Radiohead", client, { db, ttlDays: 30 });

    assert.equal(client.getCallCount(), 1);
    assert.equal(result.images.length, 2); // nieuwe data
    assert.equal(result.images[0].url, "https://img.fm/small.jpg");
  });

  it("gebruikt default TTL van 30 dagen", async () => {
    const freshDate = new Date();
    freshDate.setDate(freshDate.getDate() - 29); // 29 dagen oud — nog vers

    const cached = {
      artist: "radiohead",
      images: [{ url: "https://img.fm/cached.jpg", size: "small" }],
      fetchedAt: freshDate,
    };
    const db = createMockDb(cached);
    const client = createMockClient(ARTIST_INFO);

    const result = await getArtistImage("Radiohead", client, { db });

    assert.equal(client.getCallCount(), 0); // niet ge-re-fetcht
    assert.equal(result.images[0].url, "https://img.fm/cached.jpg");
  });

  it("custom TTL wordt gerespecteerd", async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 3); // 3 dagen oud

    const cached = {
      artist: "radiohead",
      images: [{ url: "https://img.fm/cached.jpg", size: "small" }],
      fetchedAt: recentDate,
    };
    const db = createMockDb(cached);
    const client = createMockClient(ARTIST_INFO);

    const result = await getArtistImage("Radiohead", client, { db, ttlDays: 2 });

    assert.equal(client.getCallCount(), 1); // TTL=2 dagen, 3 dagen oud → re-fetch
  });
});
