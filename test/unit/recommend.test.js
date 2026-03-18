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

// Skip tracks zonder genreVector
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

// Shared test data
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

// Pagination
describe("getRecommendations — pagination", () => {
  const profileVector = v(0);

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

// Filters
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

// Metadata
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

// Score breakdown per track
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
});

// REQ-002: Bubbel-filter — dial filtert tracks post-score
describe("getRecommendations — bubbel-filter (REQ-002)", () => {
  // Profiel is rock (index 0)
  const profileVector = v(0);

  // Tracks: rock (genreSim=1.0), gedeeltelijk rock (genreSim≈0.5), totaal anders (genreSim=0)
  const mixedTracks = [
    { _id: "t1", title: "Pure Rock", artist: "A", genreVector: v(0) }, // genreSim = 1.0
    {
      _id: "t2",
      title: "Half Rock",
      artist: "B",
      genreVector: [0.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    }, // genreSim ≈ 0.71
    {
      _id: "t3",
      title: "Quarter Rock",
      artist: "C",
      genreVector: [0.25, 0.75, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    }, // genreSim ≈ 0.32
    { _id: "t4", title: "Pure Pop", artist: "D", genreVector: v(1) }, // genreSim = 0
    { _id: "t5", title: "Pure Jazz", artist: "E", genreVector: v(5) }, // genreSim = 0
  ];

  it("Stand 1 (minGenreSim 0.6) filtert tracks met lage genreSim", async () => {
    const result = await getRecommendations({
      profileVector,
      dial: 1,
      _tracks: mixedTracks,
    });
    // Alleen Pure Rock (1.0) en Half Rock (~0.71) komen erdoor
    assert.equal(result.tracks.length, 2);
    const titles = result.tracks.map((t) => t.track.title);
    assert.ok(titles.includes("Pure Rock"));
    assert.ok(titles.includes("Half Rock"));
  });

  it("Stand 2 (minGenreSim 0.3) laat meer tracks door", async () => {
    const result = await getRecommendations({
      profileVector,
      dial: 2,
      _tracks: mixedTracks,
    });
    // Pure Rock (1.0), Half Rock (~0.71), Quarter Rock (~0.32) komen erdoor
    assert.equal(result.tracks.length, 3);
    const titles = result.tracks.map((t) => t.track.title);
    assert.ok(titles.includes("Quarter Rock"));
  });

  it("Stand 3 (geen filter) laat alles door", async () => {
    const result = await getRecommendations({
      profileVector,
      dial: 3,
      _tracks: mixedTracks,
    });
    assert.equal(result.tracks.length, 5);
  });

  it("Stand 5 (geen filter) laat alles door", async () => {
    const result = await getRecommendations({
      profileVector,
      dial: 5,
      _tracks: mixedTracks,
    });
    assert.equal(result.tracks.length, 5);
  });
});

// REQ-003: Per-stand sortering
describe("getRecommendations — per-stand sortering (REQ-003)", () => {
  const profileVector = v(0);

  it("Stand 1-3 sorteert op genreSim (desc)", async () => {
    const tracks = [
      { _id: "t1", title: "Low", artist: "A", genreVector: v(1) }, // genreSim = 0
      { _id: "t2", title: "High", artist: "B", genreVector: v(0) }, // genreSim = 1
      {
        _id: "t3",
        title: "Mid",
        artist: "C",
        genreVector: [0.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ];

    const result = await getRecommendations({
      profileVector,
      dial: 3,
      _tracks: tracks,
    });
    // High (genreSim=1) moet eerste zijn
    assert.equal(result.tracks[0].track.title, "High");
    // Low (genreSim=0) moet laatste zijn
    assert.equal(result.tracks[result.tracks.length - 1].track.title, "Low");
  });

  it("Stand 4 sorteert op CF score (desc), genreSim als fallback bij null CF", async () => {
    // Zonder CF context: alle CF scores zijn null → fallback op genreSim
    const tracks = [
      { _id: "t1", title: "Low Genre", artist: "A", genreVector: v(1) },
      { _id: "t2", title: "High Genre", artist: "B", genreVector: v(0) },
    ];

    const result = await getRecommendations({
      profileVector,
      dial: 4,
      _tracks: tracks,
    });
    // CF is null → fallback op genreSim → High Genre eerst
    assert.equal(result.tracks[0].track.title, "High Genre");
  });

  it("Stand 5 sorteert random (verschilt van genreSim volgorde)", async () => {
    // Met 20 tracks is de kans verwaarloosbaar dat random dezelfde volgorde geeft als genreSim
    const manyTracks = Array.from({ length: 20 }, (_, i) => {
      const gv = new Array(20).fill(0);
      gv[i % 20] = 1;
      return { _id: `t${i}`, title: `Track${i}`, artist: `A${i}`, genreVector: gv };
    });

    const result = await getRecommendations({
      profileVector,
      dial: 5,
      _tracks: manyTracks,
    });

    // Controleer dat het NIET gesorteerd is op genreSim desc
    // De eerste track zou Track0 zijn als het genreSim-gesorteerd was (genreSim=1.0)
    // Met 20 random tracks is de kans dat track0 toevallig bovenaan staat 1/20
    // We checken of de volgorde afwijkt (minstens 1 positie verschilt)
    const genreSorted = await getRecommendations({
      profileVector,
      dial: 3,
      _tracks: manyTracks,
    });
    const randomOrder = result.tracks.map((t) => t.track._id);
    const sortedOrder = genreSorted.tracks.map((t) => t.track._id);

    // Minstens 1 verschil in volgorde (extreem onwaarschijnlijk dat random === sorted)
    const hasDeviation = randomOrder.some((id, i) => id !== sortedOrder[i]);
    assert.ok(hasDeviation, "Stand 5 moet random sorteren, niet op genreSim");
  });
});

// REQ-004: Stand 4 onbeluisterde tracks filter
describe("getRecommendations — onbeluisterd filter (REQ-004)", () => {
  const profileVector = v(0);

  it("Stand 4 filtert tracks met bestaand feedback record", async () => {
    // _feedbackMap simuleert feedback data
    const tracks = [
      { _id: "t1", title: "Played", artist: "A", genreVector: v(0) },
      { _id: "t2", title: "Unplayed", artist: "B", genreVector: v(0) },
    ];
    const feedbackMap = new Map([["t1", { trackId: "t1", action: "like", playCount: 3 }]]);

    const result = await getRecommendations({
      profileVector,
      dial: 4,
      _tracks: tracks,
      _feedbackMap: feedbackMap,
    });

    // Alleen Unplayed komt erdoor
    assert.equal(result.tracks.length, 1);
    assert.equal(result.tracks[0].track.title, "Unplayed");
  });

  it("Stand 4 filtert tracks met playCount > 0", async () => {
    const tracks = [
      { _id: "t1", title: "Played", artist: "A", genreVector: v(0) },
      { _id: "t2", title: "Unplayed", artist: "B", genreVector: v(0) },
    ];
    const feedbackMap = new Map([
      ["t1", { trackId: "t1", action: "skip", playCount: 1 }],
      ["t2", { trackId: "t2", action: "skip", playCount: 0 }],
    ]);

    const result = await getRecommendations({
      profileVector,
      dial: 4,
      _tracks: tracks,
      _feedbackMap: feedbackMap,
    });

    // t1 heeft playCount > 0 → uitgefilterd. t2 heeft playCount 0 → doorgelaten
    assert.equal(result.tracks.length, 1);
    assert.equal(result.tracks[0].track.title, "Unplayed");
  });

  it("Andere standen filteren NIET op onbeluisterd", async () => {
    const tracks = [
      { _id: "t1", title: "Played", artist: "A", genreVector: v(0) },
      { _id: "t2", title: "Unplayed", artist: "B", genreVector: v(0) },
    ];
    const feedbackMap = new Map([["t1", { trackId: "t1", action: "like", playCount: 5 }]]);

    const result = await getRecommendations({
      profileVector,
      dial: 3,
      _tracks: tracks,
      _feedbackMap: feedbackMap,
    });

    // Beide tracks komen erdoor bij stand 3
    assert.equal(result.tracks.length, 2);
  });
});

// REQ-001 (parameterized-recommendations): Genre-filter
describe("getRecommendations — genre filter", () => {
  // Profile = rock (index 0), tracks met verschillende dominant genres
  const profileVector = v(0);
  const genreTracks = [
    { _id: "g1", title: "Rock Hit", artist: "A", genreVector: v(0) }, // dominant = rock
    { _id: "g2", title: "Pop Song", artist: "B", genreVector: v(1) }, // dominant = pop
    { _id: "g3", title: "Jazz Tune", artist: "C", genreVector: v(5) }, // dominant = jazz
    {
      _id: "g4",
      title: "Rock-ish",
      artist: "D",
      genreVector: [0.6, 0.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    }, // dominant = rock (index 0 highest)
    { _id: "g5", title: "Metal Track", artist: "E", genreVector: v(7) }, // dominant = metal
  ];

  it("filters.genre = 'rock' retourneert alleen tracks waar rock dominant is", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { genre: "rock" },
      _tracks: genreTracks,
    });
    assert.equal(result.tracks.length, 2);
    const titles = result.tracks.map((t) => t.track.title);
    assert.ok(titles.includes("Rock Hit"));
    assert.ok(titles.includes("Rock-ish"));
  });

  it("filters.genre = 'jazz' retourneert alleen jazz-dominant tracks", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { genre: "jazz" },
      _tracks: genreTracks,
    });
    assert.equal(result.tracks.length, 1);
    assert.equal(result.tracks[0].track.title, "Jazz Tune");
  });

  it("filters.genre = null heeft geen effect", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { genre: null },
      _tracks: genreTracks,
    });
    assert.equal(result.tracks.length, 5);
  });

  it("filters.genre is case-insensitive", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { genre: "Rock" },
      _tracks: genreTracks,
    });
    assert.equal(result.tracks.length, 2);
  });
});

// REQ-002 (parameterized-recommendations): Artist-filter
describe("getRecommendations — artist filter", () => {
  const profileVector = v(0);
  const artistTracks = [
    { _id: "a1", title: "Song 1", artist: "Radiohead", genreVector: v(0) },
    { _id: "a2", title: "Song 2", artist: "Radiohead", genreVector: v(1) },
    { _id: "a3", title: "Song 3", artist: "Coldplay", genreVector: v(0) },
    { _id: "a4", title: "Song 4", artist: "Muse", genreVector: v(3) },
  ];

  it("filters.artist = 'Radiohead' retourneert alleen Radiohead tracks", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { artist: "Radiohead" },
      _tracks: artistTracks,
    });
    assert.equal(result.tracks.length, 2);
    assert.ok(result.tracks.every((t) => t.track.artist === "Radiohead"));
  });

  it("artist filter is case-insensitive", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { artist: "radiohead" },
      _tracks: artistTracks,
    });
    assert.equal(result.tracks.length, 2);
  });

  it("filters.artist = null heeft geen effect", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { artist: null },
      _tracks: artistTracks,
    });
    assert.equal(result.tracks.length, 4);
  });
});

// REQ-003 (parameterized-recommendations): Additive filtering
describe("getRecommendations — additive filtering", () => {
  const profileVector = v(0);
  const comboTracks = [
    { _id: "c1", title: "RH Rock", artist: "Radiohead", genreVector: v(0) },
    { _id: "c2", title: "RH Pop", artist: "Radiohead", genreVector: v(1) },
    { _id: "c3", title: "CP Rock", artist: "Coldplay", genreVector: v(0) },
    { _id: "c4", title: "CP Pop", artist: "Coldplay", genreVector: v(1) },
  ];

  it("genre + artist filtert additief (AND)", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { genre: "rock", artist: "Radiohead" },
      _tracks: comboTracks,
    });
    assert.equal(result.tracks.length, 1);
    assert.equal(result.tracks[0].track.title, "RH Rock");
  });

  it("genre + artist + minScore past alle drie filters toe", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { genre: "rock", artist: "Radiohead", minScore: 0.5 },
      _tracks: comboTracks,
    });
    // RH Rock has genreSim=1.0 (rock profile vs rock track), so finalScore >= 0.5
    assert.equal(result.tracks.length, 1);
    assert.equal(result.tracks[0].track.title, "RH Rock");
  });

  it("genre + excludeIds combineert correct", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { genre: "rock", excludeIds: ["c1"] },
      _tracks: comboTracks,
    });
    // Only CP Rock remains (c3), c1 is excluded
    assert.equal(result.tracks.length, 1);
    assert.equal(result.tracks[0].track.title, "CP Rock");
  });
});

// REQ-004 (parameterized-recommendations): Sort-override
describe("getRecommendations — sort-override", () => {
  const profileVector = v(0);
  const sortTracks = [
    {
      _id: "s1",
      title: "Old Rock",
      artist: "A",
      genreVector: v(0),
      createdAt: new Date("2026-01-01"),
    },
    {
      _id: "s2",
      title: "New Pop",
      artist: "B",
      genreVector: v(1),
      createdAt: new Date("2026-03-15"),
    },
    {
      _id: "s3",
      title: "Mid Jazz",
      artist: "C",
      genreVector: v(5),
      createdAt: new Date("2026-02-01"),
    },
  ];

  it("filters.sort = 'genreSim' sorteert op genre similarity desc", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { sort: "genreSim" },
      _tracks: sortTracks,
    });
    // Rock track (genreSim=1.0) moet eerste zijn
    assert.equal(result.tracks[0].track.title, "Old Rock");
  });

  it("filters.sort = 'recent' sorteert op createdAt desc", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { sort: "recent" },
      _tracks: sortTracks,
    });
    assert.equal(result.tracks[0].track.title, "New Pop");
    assert.equal(result.tracks[1].track.title, "Mid Jazz");
    assert.equal(result.tracks[2].track.title, "Old Rock");
  });

  it("filters.sort = 'random' geeft random volgorde", async () => {
    const manyTracks = Array.from({ length: 20 }, (_, i) => ({
      _id: `r${i}`,
      title: `Track${i}`,
      artist: `A${i}`,
      genreVector: v(i % 20),
    }));
    const result = await getRecommendations({
      profileVector,
      filters: { sort: "random" },
      _tracks: manyTracks,
    });
    const sorted = await getRecommendations({
      profileVector,
      _tracks: manyTracks,
    });
    const randomIds = result.tracks.map((t) => t.track._id);
    const sortedIds = sorted.tracks.map((t) => t.track._id);
    const hasDeviation = randomIds.some((id, i) => id !== sortedIds[i]);
    assert.ok(hasDeviation, "sort-override random moet afwijken van default");
  });

  it("sort-override vervangt dial sortSignal maar bubbel-filter blijft actief", async () => {
    // Stand 1 heeft minGenreSim 0.6 filter — die moet nog werken
    const result = await getRecommendations({
      profileVector,
      dial: 1,
      filters: { sort: "recent" },
      _tracks: sortTracks,
    });
    // Bubbel-filter (minGenreSim 0.6) filtert Pop en Jazz eruit, alleen Rock blijft
    assert.equal(result.tracks.length, 1);
    assert.equal(result.tracks[0].track.title, "Old Rock");
  });

  it("filters.sort = null gebruikt default dial sortering", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { sort: null },
      _tracks: sortTracks,
    });
    // Default = genreSim desc (Stand 3)
    assert.equal(result.tracks[0].track.title, "Old Rock");
  });
});

// REQ-005 (parameterized-recommendations): Explicit-toggle
describe("getRecommendations — explicit filter", () => {
  const profileVector = v(0);
  const explicitTracks = [
    { _id: "e1", title: "Clean Rock", artist: "A", genreVector: v(0), explicit: false },
    { _id: "e2", title: "Dirty Rock", artist: "B", genreVector: v(0), explicit: true },
    { _id: "e3", title: "Unknown", artist: "C", genreVector: v(0) }, // no explicit field
  ];

  it("filters.explicit = false excludeert explicit tracks", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { explicit: false },
      _tracks: explicitTracks,
    });
    assert.ok(result.tracks.every((t) => t.track.explicit !== true));
    assert.equal(result.tracks.length, 2); // Clean Rock + Unknown
  });

  it("filters.explicit = true retourneert alleen explicit tracks", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { explicit: true },
      _tracks: explicitTracks,
    });
    assert.equal(result.tracks.length, 1);
    assert.equal(result.tracks[0].track.title, "Dirty Rock");
  });

  it("filters.explicit = null/undefined heeft geen effect", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { explicit: null },
      _tracks: explicitTracks,
    });
    assert.equal(result.tracks.length, 3);
  });
});

// REQ-006 (parameterized-recommendations): Unplayed-filter
describe("getRecommendations — unplayed filter", () => {
  const profileVector = v(0);
  const unplayedTracks = [
    { _id: "u1", title: "Played Track", artist: "A", genreVector: v(0) },
    { _id: "u2", title: "Unplayed Track", artist: "B", genreVector: v(0) },
    { _id: "u3", title: "Zero Plays", artist: "C", genreVector: v(0) },
  ];

  it("filters.unplayed = true retourneert alleen tracks zonder feedback", async () => {
    const feedbackMap = new Map([["u1", { trackId: "u1", action: "like", playCount: 5 }]]);
    const result = await getRecommendations({
      profileVector,
      filters: { unplayed: true },
      _tracks: unplayedTracks,
      _feedbackMap: feedbackMap,
    });
    assert.equal(result.tracks.length, 2);
    const titles = result.tracks.map((t) => t.track.title);
    assert.ok(titles.includes("Unplayed Track"));
    assert.ok(titles.includes("Zero Plays"));
  });

  it("filters.unplayed = true houdt tracks met playCount=0", async () => {
    const feedbackMap = new Map([
      ["u1", { trackId: "u1", action: "skip", playCount: 3 }],
      ["u3", { trackId: "u3", action: "skip", playCount: 0 }],
    ]);
    const result = await getRecommendations({
      profileVector,
      filters: { unplayed: true },
      _tracks: unplayedTracks,
      _feedbackMap: feedbackMap,
    });
    assert.equal(result.tracks.length, 2);
    const titles = result.tracks.map((t) => t.track.title);
    assert.ok(titles.includes("Unplayed Track"));
    assert.ok(titles.includes("Zero Plays"));
  });

  it("filters.unplayed = false/null heeft geen effect", async () => {
    const feedbackMap = new Map([["u1", { trackId: "u1", action: "like", playCount: 5 }]]);
    const result = await getRecommendations({
      profileVector,
      filters: { unplayed: false },
      _tracks: unplayedTracks,
      _feedbackMap: feedbackMap,
    });
    assert.equal(result.tracks.length, 3);
  });
});

// REQ-007 (parameterized-recommendations): Recent-filter
describe("getRecommendations — recentDays filter", () => {
  const profileVector = v(0);
  const now = new Date("2026-03-16");
  const recentTracks = [
    {
      _id: "r1",
      title: "Today",
      artist: "A",
      genreVector: v(0),
      createdAt: new Date("2026-03-16"),
    },
    {
      _id: "r2",
      title: "Last Week",
      artist: "B",
      genreVector: v(0),
      createdAt: new Date("2026-03-10"),
    },
    {
      _id: "r3",
      title: "Last Month",
      artist: "C",
      genreVector: v(0),
      createdAt: new Date("2026-02-14"),
    },
    { _id: "r4", title: "Old", artist: "D", genreVector: v(0), createdAt: new Date("2026-01-01") },
  ];

  it("filters.recentDays = 7 retourneert tracks van laatste 7 dagen", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { recentDays: 7 },
      _tracks: recentTracks,
      overrides: { _now: now },
    });
    assert.equal(result.tracks.length, 2);
    const titles = result.tracks.map((t) => t.track.title);
    assert.ok(titles.includes("Today"));
    assert.ok(titles.includes("Last Week"));
  });

  it("filters.recentDays = 30 retourneert meer tracks", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { recentDays: 30 },
      _tracks: recentTracks,
      overrides: { _now: now },
    });
    assert.equal(result.tracks.length, 3); // Today, Last Week, Last Month
  });

  it("filters.recentDays = null heeft geen effect", async () => {
    const result = await getRecommendations({
      profileVector,
      filters: { recentDays: null },
      _tracks: recentTracks,
    });
    assert.equal(result.tracks.length, 4);
  });
});

// Dial parameter + dialPosition in meta
describe("getRecommendations — dial parameter", () => {
  const profileVector = v(0);

  it("dial parameter resolved naar preset", async () => {
    const result = await getRecommendations({
      profileVector,
      dial: 1,
      _tracks: testTracks,
    });
    assert.equal(result.meta.dialPosition, 1);
  });

  it("geen dial → default Stand 3", async () => {
    const result = await getRecommendations({
      profileVector,
      _tracks: testTracks,
    });
    assert.equal(result.meta.dialPosition, 3);
  });

  it("ongeldige dial gooit error", async () => {
    await assert.rejects(
      () => getRecommendations({ profileVector, dial: 0, _tracks: testTracks }),
      RangeError,
    );
  });
});

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

  it("dialPosition = 3 bij geen dial (default)", async () => {
    const result = await getRecommendations({
      profileVector,
      _tracks: testTracks,
    });
    assert.equal(result.meta.dialPosition, 3);
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
    assert.ok("activeSignals" in result.meta);
    assert.ok("dialPosition" in result.meta);
  });
});
