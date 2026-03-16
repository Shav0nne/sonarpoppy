import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeCfScore } from "../../src/services/cf/cfScore.js";

describe("computeCfScore", () => {
  // Helpers: liked tracks as Set of "artist|title" keys, liked artists as Set of artist names
  const likedTrackKeys = new Set([
    "queen|bohemian rhapsody",
    "queen|under pressure",
    "david bowie|heroes",
  ]);
  const likedArtists = new Set(["queen", "david bowie"]);

  it("returns null when track is not CF enriched (no cfEnrichedAt)", () => {
    const candidate = { similarTracks: [], similarArtists: [], cfEnrichedAt: null };
    const score = computeCfScore(candidate, likedTrackKeys, likedArtists);
    assert.equal(score, null);
  });

  it("returns null when track has no similarTracks and no similarArtists", () => {
    const candidate = { similarTracks: [], similarArtists: [], cfEnrichedAt: new Date() };
    const score = computeCfScore(candidate, likedTrackKeys, likedArtists);
    assert.equal(score, null);
  });

  it("returns null when there is no overlap at all", () => {
    const candidate = {
      similarTracks: [{ artist: "Unknown", title: "Song", match: 0.9 }],
      similarArtists: [{ artist: "Nobody", match: 0.8 }],
      cfEnrichedAt: new Date(),
    };
    const score = computeCfScore(candidate, likedTrackKeys, likedArtists);
    assert.equal(score, null);
  });

  it("computes track overlap score (weighted 0.7)", () => {
    const candidate = {
      similarTracks: [
        { artist: "Queen", title: "Bohemian Rhapsody", match: 0.9 },
        { artist: "Unknown", title: "Nothing", match: 0.8 },
      ],
      similarArtists: [],
      cfEnrichedAt: new Date(),
    };
    // Track overlap: 1 match (0.9) out of 2 tracks → avg match = 0.9
    // Only track signal → re-normalize: trackScore = 0.9, weight = 1.0
    const score = computeCfScore(candidate, likedTrackKeys, likedArtists);
    assert.ok(typeof score === "number");
    assert.ok(score > 0);
    assert.ok(score <= 1);
  });

  it("computes artist overlap score (weighted 0.3)", () => {
    const candidate = {
      similarTracks: [],
      similarArtists: [
        { artist: "Queen", match: 0.85 },
        { artist: "Nobody", match: 0.7 },
      ],
      cfEnrichedAt: new Date(),
    };
    // Artist overlap: 1 match (0.85) out of 2 → avg match = 0.85
    // Only artist signal → re-normalize: artistScore = 0.85, weight = 1.0
    const score = computeCfScore(candidate, likedTrackKeys, likedArtists);
    assert.ok(typeof score === "number");
    assert.ok(score > 0);
    assert.ok(score <= 1);
  });

  it("combines track (0.7) and artist (0.3) overlap", () => {
    const candidate = {
      similarTracks: [
        { artist: "Queen", title: "Bohemian Rhapsody", match: 0.9 },
        { artist: "Queen", title: "Under Pressure", match: 0.8 },
      ],
      similarArtists: [
        { artist: "David Bowie", match: 0.85 },
        { artist: "Nobody", match: 0.7 },
      ],
      cfEnrichedAt: new Date(),
    };
    // Track overlap: 2/2 matched → avg match = (0.9+0.8)/2 = 0.85
    // Artist overlap: 1/2 matched → avg match of matched = 0.85
    // Combined: 0.7 * 0.85 + 0.3 * 0.85 = 0.595 + 0.255 = 0.85
    const score = computeCfScore(candidate, likedTrackKeys, likedArtists);
    assert.ok(score > 0.8 && score <= 0.9, `expected ~0.85, got ${score}`);
  });

  it("matching is case-insensitive", () => {
    const candidate = {
      similarTracks: [{ artist: "QUEEN", title: "BOHEMIAN RHAPSODY", match: 0.9 }],
      similarArtists: [{ artist: "DAVID BOWIE", match: 0.85 }],
      cfEnrichedAt: new Date(),
    };
    const score = computeCfScore(candidate, likedTrackKeys, likedArtists);
    assert.ok(typeof score === "number");
    assert.ok(score > 0);
  });

  it("returns value between 0 and 1", () => {
    const candidate = {
      similarTracks: [{ artist: "Queen", title: "Bohemian Rhapsody", match: 1.0 }],
      similarArtists: [{ artist: "Queen", match: 1.0 }],
      cfEnrichedAt: new Date(),
    };
    const score = computeCfScore(candidate, likedTrackKeys, likedArtists);
    assert.ok(score >= 0 && score <= 1, `score ${score} out of range`);
  });

  it("handles empty liked sets", () => {
    const candidate = {
      similarTracks: [{ artist: "Queen", title: "Bohemian Rhapsody", match: 0.9 }],
      similarArtists: [{ artist: "Queen", match: 0.85 }],
      cfEnrichedAt: new Date(),
    };
    const score = computeCfScore(candidate, new Set(), new Set());
    assert.equal(score, null);
  });

  it("re-normalizes when only track overlap exists", () => {
    const candidate = {
      similarTracks: [{ artist: "Queen", title: "Bohemian Rhapsody", match: 0.9 }],
      similarArtists: [{ artist: "Nobody", match: 0.5 }],
      cfEnrichedAt: new Date(),
    };
    // Track overlap present, artist overlap = 0
    // Re-normalize: track gets full weight
    const score = computeCfScore(candidate, likedTrackKeys, likedArtists);
    assert.ok(typeof score === "number");
    assert.ok(score > 0);
  });
});
