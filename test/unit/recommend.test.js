import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreTracks, getRecommendations } from "../../src/services/recommendation/recommend.js";

// REQ-001: Scoor alle tracks tegen profielvector via cosine similarity
describe("scoreTracks — scoring via cosine similarity", () => {
  const profileVector = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  it("retourneert een array met track breakdown objecten", () => {
    const tracks = [
      {
        _id: "t1",
        title: "A",
        artist: "X",
        genreVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ];
    const result = scoreTracks(profileVector, tracks);
    assert.equal(result.length, 1);
    assert.ok("track" in result[0]);
    assert.ok("finalScore" in result[0]);
    assert.ok("signals" in result[0]);
    assert.ok("appliedWeights" in result[0]);
    assert.ok("feedbackMultiplier" in result[0]);
  });

  it("berekent correcte scores", () => {
    const tracks = [
      {
        _id: "t1",
        title: "A",
        artist: "X",
        genreVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        _id: "t2",
        title: "B",
        artist: "Y",
        genreVector: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ];
    const result = scoreTracks(profileVector, tracks);
    // Genre is het enige actieve signaal → 100% gewicht → finalScore = genre score
    assert.equal(result[0].finalScore, 1);
    assert.equal(result[1].finalScore, 0);
  });

  it("sorteert op finalScore desc", () => {
    const tracks = [
      {
        _id: "t1",
        title: "Low",
        artist: "X",
        genreVector: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      {
        _id: "t2",
        title: "High",
        artist: "Y",
        genreVector: [0.8, 0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ];
    const result = scoreTracks(profileVector, tracks);
    assert.ok(result[0].finalScore >= result[1].finalScore, "eerste score moet >= tweede zijn");
    assert.equal(result[0].track.title, "High");
  });

  it("behoudt track data in het resultaat", () => {
    const tracks = [
      {
        _id: "t1",
        title: "Song",
        artist: "Band",
        album: "LP",
        genreVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ];
    const result = scoreTracks(profileVector, tracks);
    assert.equal(result[0].track.title, "Song");
    assert.equal(result[0].track.artist, "Band");
  });

  it("retourneert lege array bij lege tracks input", () => {
    const result = scoreTracks(profileVector, []);
    assert.deepEqual(result, []);
  });
});

// REQ-003: Skip tracks zonder geldige genreVector
describe("scoreTracks — skip tracks zonder genreVector", () => {
  const profileVector = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  it("skipt tracks zonder genreVector property", () => {
    const tracks = [
      {
        _id: "t1",
        title: "Valid",
        artist: "X",
        genreVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      { _id: "t2", title: "NoVector", artist: "Y" },
    ];
    const result = scoreTracks(profileVector, tracks);
    assert.equal(result.length, 1);
    assert.equal(result[0].track.title, "Valid");
  });

  it("skipt tracks met lege genreVector array", () => {
    const tracks = [
      {
        _id: "t1",
        title: "Valid",
        artist: "X",
        genreVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      { _id: "t2", title: "Empty", artist: "Y", genreVector: [] },
    ];
    const result = scoreTracks(profileVector, tracks);
    assert.equal(result.length, 1);
    assert.equal(result[0].track.title, "Valid");
  });

  it("skipt tracks met null genreVector", () => {
    const tracks = [
      {
        _id: "t1",
        title: "Valid",
        artist: "X",
        genreVector: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      { _id: "t2", title: "Null", artist: "Y", genreVector: null },
    ];
    const result = scoreTracks(profileVector, tracks);
    assert.equal(result.length, 1);
  });
});

// Shared test data voor getRecommendations tests
const v = (primary) => {
  const vec = new Array(20).fill(0);
  vec[primary] = 1;
  return vec;
};

const testTracks = [
  { _id: "t1", title: "Rock Hit", artist: "A", genreVector: v(0) },
  { _id: "t2", title: "Pop Song", artist: "B", genreVector: v(1) },
  { _id: "t3", title: "Jazz Tune", artist: "C", genreVector: v(5) },
  { _id: "t4", title: "Metal Riff", artist: "D", genreVector: v(3) },
  { _id: "t5", title: "Blues Track", artist: "E", genreVector: v(8) },
];

// REQ-002: Sorteer op score (desc) en retourneer top N met pagination
describe("getRecommendations — pagination", () => {
  const profileVector = v(0); // rock profiel

  it("retourneert standaard alle gescoorde tracks", async () => {
    const result = await getRecommendations({ profileVector, _tracks: testTracks });
    assert.equal(result.tracks.length, 5);
  });

  it("beperkt resultaten met limit", async () => {
    const result = await getRecommendations({ profileVector, limit: 2, _tracks: testTracks });
    assert.equal(result.tracks.length, 2);
  });

  it("skipt resultaten met offset", async () => {
    const all = await getRecommendations({ profileVector, _tracks: testTracks });
    const paged = await getRecommendations({ profileVector, offset: 2, _tracks: testTracks });
    assert.equal(paged.tracks[0].track._id, all.tracks[2].track._id);
  });

  it("total is onafhankelijk van limit/offset", async () => {
    const result = await getRecommendations({
      profileVector,
      limit: 1,
      offset: 1,
      _tracks: testTracks,
    });
    assert.equal(result.total, 5);
    assert.equal(result.tracks.length, 1);
  });

  it("retourneert lege array als offset voorbij total is", async () => {
    const result = await getRecommendations({ profileVector, offset: 100, _tracks: testTracks });
    assert.equal(result.tracks.length, 0);
    assert.equal(result.total, 5);
  });
});

// REQ-004: Accepteer filters object als extensiepunt
describe("getRecommendations — filters", () => {
  const profileVector = v(0);

  it("filtert tracks met finalScore onder minScore", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { minScore: 0.5 },
      _tracks: testTracks,
    });
    assert.ok(result.tracks.every((t) => t.finalScore >= 0.5));
    assert.ok(result.tracks.length < 5);
  });

  it("sluit tracks uit met excludeIds", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { excludeIds: ["t1", "t2"] },
      _tracks: testTracks,
    });
    assert.ok(result.tracks.every((t) => !["t1", "t2"].includes(t.track._id)));
  });

  it("lege filters = geen effect", async () => {
    const withFilters = await getRecommendations({
      profileVector,
      filters: {},
      _tracks: testTracks,
    });
    const without = await getRecommendations({
      profileVector,
      _tracks: testTracks,
    });
    assert.equal(withFilters.tracks.length, without.tracks.length);
  });

  it("total na filters reflecteert gefilterde count", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { excludeIds: ["t1"] },
      _tracks: testTracks,
    });
    assert.equal(result.total, 4);
  });
});

// REQ-005: Retourneer metadata + breakdown
describe("getRecommendations — metadata", () => {
  const profileVector = v(0);

  it("bevat scoredAt als ISO timestamp", async () => {
    const result = await getRecommendations({ profileVector, _tracks: testTracks });
    assert.ok(result.meta.scoredAt);
    assert.ok(!isNaN(Date.parse(result.meta.scoredAt)));
  });

  it("berekent avgScore correct", async () => {
    const result = await getRecommendations({ profileVector, _tracks: testTracks });
    const expectedAvg = result.tracks.reduce((s, t) => s + t.finalScore, 0) / result.tracks.length;
    assert.equal(result.meta.avgScore, expectedAvg);
  });

  it("bevat scoreRange met min en max", async () => {
    const result = await getRecommendations({ profileVector, _tracks: testTracks });
    assert.ok("min" in result.meta.scoreRange);
    assert.ok("max" in result.meta.scoreRange);
    assert.ok(result.meta.scoreRange.max >= result.meta.scoreRange.min);
  });

  it("meta bij lege resultaten geeft zinvolle defaults", async () => {
    const result = await getRecommendations({ profileVector, _tracks: [] });
    assert.equal(result.meta.avgScore, 0);
    assert.equal(result.meta.scoreRange.min, 0);
    assert.equal(result.meta.scoreRange.max, 0);
  });

  it("meta bevat configuredWeights (Stand 3 default)", async () => {
    const result = await getRecommendations({ profileVector, _tracks: testTracks });
    assert.deepEqual(result.meta.configuredWeights, { genre: 0.5, cf: 0.5 });
  });

  it("meta bevat activeSignals", async () => {
    const result = await getRecommendations({ profileVector, _tracks: testTracks });
    assert.ok(Array.isArray(result.meta.activeSignals));
    assert.ok(result.meta.activeSignals.includes("genre"));
  });

  it("meta activeSignals is leeg bij geen tracks", async () => {
    const result = await getRecommendations({ profileVector, _tracks: [] });
    assert.deepEqual(result.meta.activeSignals, []);
  });
});

// REQ-005: Score breakdown per track
describe("getRecommendations — score breakdown", () => {
  const profileVector = v(0);

  it("elke track bevat finalScore, signals, appliedWeights, feedbackMultiplier", async () => {
    const result = await getRecommendations({ profileVector, _tracks: testTracks });
    for (const item of result.tracks) {
      assert.ok("finalScore" in item);
      assert.ok("signals" in item);
      assert.ok("appliedWeights" in item);
      assert.ok("feedbackMultiplier" in item);
    }
  });

  it("signals bevat genre score en cf als null", async () => {
    const result = await getRecommendations({ profileVector, _tracks: testTracks });
    const first = result.tracks[0];
    assert.equal(typeof first.signals.genre, "number");
    assert.equal(first.signals.cf, null);
  });

  it("accepteert custom weights via parameter", async () => {
    const custom = { genre: 0.7, cf: 0.3 };
    const result = await getRecommendations({
      profileVector,
      weights: custom,
      _tracks: testTracks,
    });
    assert.deepEqual(result.meta.configuredWeights, custom);
  });
});

// REQ-004: dial parameter resolved naar weights
describe("getRecommendations — dial parameter", () => {
  const profileVector = v(0);

  it("dial: 1 resolved naar Stand 1 gewichten", async () => {
    const result = await getRecommendations({
      profileVector,
      dial: 1,
      _tracks: testTracks,
    });
    assert.deepEqual(result.meta.configuredWeights, { genre: 0.7, cf: 0.3 });
  });

  it("dial: 5 resolved naar Stand 5 gewichten", async () => {
    const result = await getRecommendations({
      profileVector,
      dial: 5,
      _tracks: testTracks,
    });
    assert.deepEqual(result.meta.configuredWeights, { genre: 0.3, cf: 0.7 });
  });

  it("dial overschrijft weights als beide aanwezig", async () => {
    const result = await getRecommendations({
      profileVector,
      dial: 1,
      weights: { genre: 0.9, cf: 0.1 },
      _tracks: testTracks,
    });
    // dial wint: Stand 1 gewichten
    assert.deepEqual(result.meta.configuredWeights, { genre: 0.7, cf: 0.3 });
  });

  it("geen dial + geen weights → default Stand 3", async () => {
    const result = await getRecommendations({
      profileVector,
      _tracks: testTracks,
    });
    assert.deepEqual(result.meta.configuredWeights, { genre: 0.5, cf: 0.5 });
  });

  it("ongeldige dial gooit error", async () => {
    await assert.rejects(
      () => getRecommendations({ profileVector, dial: 0, _tracks: testTracks }),
      RangeError,
    );
  });
});

// REQ-005: dialPosition in meta
describe("getRecommendations — dialPosition in meta", () => {
  const profileVector = v(0);

  it("dialPosition = dial stand bij dial parameter", async () => {
    const result = await getRecommendations({
      profileVector,
      dial: 4,
      _tracks: testTracks,
    });
    assert.equal(result.meta.dialPosition, 4);
  });

  it("dialPosition = 3 bij geen dial en geen weights (default)", async () => {
    const result = await getRecommendations({
      profileVector,
      _tracks: testTracks,
    });
    assert.equal(result.meta.dialPosition, 3);
  });

  it("dialPosition = null bij custom weights", async () => {
    const result = await getRecommendations({
      profileVector,
      weights: { genre: 0.7, cf: 0.3 },
      _tracks: testTracks,
    });
    assert.equal(result.meta.dialPosition, null);
  });

  it("bestaande meta velden blijven intact", async () => {
    const result = await getRecommendations({
      profileVector,
      dial: 2,
      _tracks: testTracks,
    });
    assert.ok(result.meta.scoredAt);
    assert.ok("avgScore" in result.meta);
    assert.ok("scoreRange" in result.meta);
    assert.ok("configuredWeights" in result.meta);
    assert.ok("activeSignals" in result.meta);
    assert.ok("dialPosition" in result.meta);
  });
});
