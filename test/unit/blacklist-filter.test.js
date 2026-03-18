import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  isGenreBlocked,
  getBlacklistFilters,
} from "../../src/services/blacklist/blacklistFilter.js";
import Blacklist from "../../src/models/Blacklist.js";
import { GENRE_COUNT, genreNameToIndex } from "../../src/config/genres.js";

function createVector(configs) {
  const vector = new Array(GENRE_COUNT).fill(0);
  for (const [genreName, val] of Object.entries(configs)) {
    const idx = genreNameToIndex(genreName);
    if (idx !== null) vector[idx] = val;
  }
  return vector;
}

describe("Blacklist Filter - isGenreBlocked", () => {
  it("should return false if empty blocked genres or empty vector", () => {
    assert.strictEqual(isGenreBlocked([0.1], []), false);
    assert.strictEqual(isGenreBlocked([], ["rock"]), false);
    assert.strictEqual(isGenreBlocked(null, ["rock"]), false);
  });

  it("should block if dominant genre is in blocked list", () => {
    // rock is dominant (0.8)
    const vector = createVector({ rock: 0.8, pop: 0.3 });
    assert.strictEqual(isGenreBlocked(vector, ["rock"]), true);
    assert.strictEqual(isGenreBlocked(vector, ["pop"]), false);
  });

  it("should block if a blocked genre is >= 0.4 threshold", () => {
    // pop is dominant (0.9), rock is secondary but passes threshold (0.5)
    const vector = createVector({ pop: 0.9, rock: 0.5 });

    assert.strictEqual(isGenreBlocked(vector, ["rock"]), true);
    assert.strictEqual(isGenreBlocked(vector, ["pop"]), true);
  });

  it("should not block if a blocked genre is < 0.4 and not dominant", () => {
    // pop is dominant (0.9), rock is secondary but below threshold (0.3)
    const vector = createVector({ pop: 0.9, rock: 0.3 });

    assert.strictEqual(isGenreBlocked(vector, ["rock"]), false);
    assert.strictEqual(isGenreBlocked(vector, ["pop"]), true);
  });

  it("should block if dominant genre is < 0.4 but in blocked list", () => {
    // all scores are low, but rock is still the dominant one
    const vector = createVector({ rock: 0.2, pop: 0.1 });
    assert.strictEqual(isGenreBlocked(vector, ["rock"]), true);
    assert.strictEqual(isGenreBlocked(vector, ["pop"]), false);
  });

  it("should handle all-zero vector — dominant index defaults to 0 (rock)", () => {
    // BUG: all-zero vector picks index 0 (rock) as dominant because 0 > -1
    const vector = new Array(GENRE_COUNT).fill(0);
    assert.strictEqual(isGenreBlocked(vector, ["rock"]), true);
    assert.strictEqual(isGenreBlocked(vector, ["pop"]), false);
  });

  it("should block at exact 0.4 threshold boundary (inclusive)", () => {
    const at = createVector({ pop: 0.9, rock: 0.4 });
    assert.strictEqual(isGenreBlocked(at, ["rock"]), true);

    const below = createVector({ pop: 0.9, rock: 0.39 });
    assert.strictEqual(isGenreBlocked(below, ["rock"]), false);
  });
});

describe("Blacklist Filter - getBlacklistFilters", () => {
  let mongoServer;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Blacklist.deleteMany({});
  });

  it("should return empty arrays for null/undefined/empty userId", async () => {
    const r1 = await getBlacklistFilters(null);
    assert.deepStrictEqual(r1, { blockedTracks: [], blockedArtists: [], blockedGenres: [] });

    const r2 = await getBlacklistFilters(undefined);
    assert.deepStrictEqual(r2, { blockedTracks: [], blockedArtists: [], blockedGenres: [] });

    const r3 = await getBlacklistFilters("");
    assert.deepStrictEqual(r3, { blockedTracks: [], blockedArtists: [], blockedGenres: [] });
  });

  it("should return empty arrays when no blacklist document exists", async () => {
    const result = await getBlacklistFilters("nonexistent-user");
    assert.deepStrictEqual(result, { blockedTracks: [], blockedArtists: [], blockedGenres: [] });
  });

  it("should split mixed entries into correct buckets", async () => {
    await Blacklist.create({
      userId: "split-user",
      entries: [
        { type: "track", value: "track-1" },
        { type: "track", value: "track-2" },
        { type: "artist", value: "Artist A" },
        { type: "genre", value: "rock" },
        { type: "genre", value: "metal" },
      ],
    });

    const result = await getBlacklistFilters("split-user");
    assert.deepStrictEqual(result.blockedTracks, ["track-1", "track-2"]);
    assert.deepStrictEqual(result.blockedArtists, ["Artist A"]);
    assert.deepStrictEqual(result.blockedGenres, ["rock", "metal"]);
  });

  it("should return empty arrays when entries array is empty", async () => {
    await Blacklist.create({ userId: "empty-user", entries: [] });
    const result = await getBlacklistFilters("empty-user");
    assert.deepStrictEqual(result, { blockedTracks: [], blockedArtists: [], blockedGenres: [] });
  });
});
