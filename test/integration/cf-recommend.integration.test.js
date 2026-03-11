import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Track from "../../src/models/Track.js";
import Feedback from "../../src/models/Feedback.js";
import { getRecommendations } from "../../src/services/recommendation/recommend.js";

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Track.syncIndexes();
  await Feedback.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Track.deleteMany({});
  await Feedback.deleteMany({});
});

const v = (primary) => {
  const vec = new Array(20).fill(0);
  vec[primary] = 1;
  return vec;
};

// Helper: mixed genre vector met cosine similarity ~0.707 tegen v(primary)
// [0.5, 0.5, 0, ...] vs [1, 0, ...] → cosine = 0.5/√0.5 ≈ 0.707
const mixVec = (primary, secondary) => {
  const vec = new Array(20).fill(0);
  vec[primary] = 0.5;
  vec[secondary] = 0.5;
  return vec;
};

// Item 6: CF score beinvloedt recommendation ranking
describe("CF score beinvloedt recommendation ranking (dial=4)", () => {
  it("enriched tracks met CF overlap scoren hoger dan niet-enriched tracks bij dial=4", async () => {
    // Scenario: alle tracks hebben genre score ~0.707 (via mixVec).
    // Track A heeft hoge CF overlap (~0.87). Track B/C hebben geen CF overlap (cf=null).
    //
    // Scoring altijd 50/50 (dial is filter, niet gewichtenverschuiver).
    // Re-normalisatie: wanneer cf=null, hybridScore geeft 100% gewicht aan genre.
    // Track B/C: finalScore = 1.0 * 0.707 = 0.707
    // Track A (50/50): 0.5*0.707 + 0.5*0.87 = 0.354 + 0.435 = 0.789
    // A (0.789) > B/C (0.707) ✓

    const candidateVec = mixVec(0, 1); // rock+pop mix, cosine ~0.707 vs v(0)

    const [trackA, trackB, trackC] = await Track.create([
      {
        title: "Enriched High Overlap",
        artist: "Artist A",
        genreVector: candidateVec,
        similarTracks: [
          { artist: "Queen", title: "Bohemian Rhapsody", match: 0.9 },
          { artist: "Led Zeppelin", title: "Stairway", match: 0.85 },
        ],
        similarArtists: [
          { artist: "Queen", match: 0.9 },
          { artist: "Led Zeppelin", match: 0.8 },
        ],
        cfEnrichedAt: new Date(),
      },
      {
        title: "Enriched No Overlap",
        artist: "Artist B",
        genreVector: candidateVec,
        similarTracks: [{ artist: "Unknown Band", title: "Unknown Song", match: 0.7 }],
        similarArtists: [{ artist: "Nobody", match: 0.6 }],
        cfEnrichedAt: new Date(),
      },
      {
        title: "Not Enriched",
        artist: "Artist C",
        genreVector: candidateVec,
      },
    ]);

    const userId = "user-cf-test";

    // Liked tracks die overlappen met trackA's similarTracks/similarArtists
    const [likedTrack1, likedTrack2] = await Track.create([
      { title: "Bohemian Rhapsody", artist: "Queen", genreVector: v(0) },
      { title: "Stairway", artist: "Led Zeppelin", genreVector: v(0) },
    ]);

    await Feedback.create([
      { userId, trackId: likedTrack1._id, action: "like" },
      { userId, trackId: likedTrack2._id, action: "like" },
    ]);

    // dial=4 → genre: 0.4, cf: 0.6 (CF-zwaar)
    const result = await getRecommendations({
      profileVector: v(0), // pure rock profiel
      dial: 4,
      userId,
    });

    const enrichedHighOverlap = result.tracks.find(
      (t) => t.track.title === "Enriched High Overlap",
    );
    const enrichedNoOverlap = result.tracks.find((t) => t.track.title === "Enriched No Overlap");
    const notEnriched = result.tracks.find((t) => t.track.title === "Not Enriched");

    assert.ok(enrichedHighOverlap, "Enriched High Overlap track gevonden");
    assert.ok(enrichedNoOverlap, "Enriched No Overlap track gevonden");
    assert.ok(notEnriched, "Not Enriched track gevonden");

    // Track A (CF overlap) moet hoger scoren dan track B (geen CF overlap, cf=null)
    assert.ok(
      enrichedHighOverlap.finalScore > enrichedNoOverlap.finalScore,
      `Enriched met overlap (${enrichedHighOverlap.finalScore}) moet hoger scoren dan enriched zonder overlap (${enrichedNoOverlap.finalScore})`,
    );

    // Track A (CF overlap) moet hoger scoren dan track C (niet enriched, cf=null)
    assert.ok(
      enrichedHighOverlap.finalScore > notEnriched.finalScore,
      `Enriched met overlap (${enrichedHighOverlap.finalScore}) moet hoger scoren dan niet-enriched (${notEnriched.finalScore})`,
    );

    // signals.cf moet een number zijn voor track A (overlap)
    assert.equal(
      typeof enrichedHighOverlap.signals.cf,
      "number",
      "signals.cf is number voor enriched track met overlap",
    );
    assert.ok(enrichedHighOverlap.signals.cf > 0, "signals.cf > 0 voor track met overlap");

    // signals.cf is null voor tracks zonder CF overlap
    assert.equal(
      enrichedNoOverlap.signals.cf,
      null,
      "signals.cf is null voor enriched zonder overlap",
    );
    assert.equal(notEnriched.signals.cf, null, "signals.cf is null voor niet-enriched");

    // appliedWeights bij dial=4: scoring altijd 50/50 (dial is nu filter, niet gewichtenverschuiver)
    assert.equal(
      enrichedHighOverlap.appliedWeights.cf,
      0.5,
      "appliedWeights.cf = 0.5 (scoring altijd 50/50)",
    );
    assert.equal(
      enrichedHighOverlap.appliedWeights.genre,
      0.5,
      "appliedWeights.genre = 0.5 (scoring altijd 50/50)",
    );

    // Meta moet dial position 4 bevestigen
    assert.equal(result.meta.dialPosition, 4);
  });
});

// Item 7: Enrich → Recommend pipeline (integratie)
describe("Enrich → Recommend pipeline: CF data stroomt correct naar scoring", () => {
  it("signals.cf verschijnt voor enriched tracks met overlap, null voor niet-enriched", async () => {
    const userId = "user-pipeline-test";

    // Liked track die CF overlap creëert
    const [likedTrack] = await Track.create([
      {
        title: "Heroes",
        artist: "David Bowie",
        genreVector: v(5), // jazz
      },
    ]);

    await Feedback.create([{ userId, trackId: likedTrack._id, action: "library" }]);

    // Genre vector: jazz+blues mix, cosine ~0.707 vs v(5)
    // Tracks zonder overlap: finalScore = 1.0 * 0.707 = 0.707
    // Track met overlap (dial=3 → genre:0.5, cf:0.5):
    //   cf = 0.7*0.95 + 0.3*0.88 = 0.929
    //   finalScore = 0.5*0.707 + 0.5*0.929 = 0.354 + 0.465 = 0.818 > 0.707 ✓
    const candidateVec = mixVec(5, 10); // jazz+blues mix

    await Track.create([
      {
        title: "Enriched With Overlap",
        artist: "Candidate A",
        genreVector: candidateVec,
        similarTracks: [{ artist: "David Bowie", title: "Heroes", match: 0.95 }],
        similarArtists: [{ artist: "David Bowie", match: 0.88 }],
        cfEnrichedAt: new Date(),
      },
      {
        title: "Enriched No Overlap",
        artist: "Candidate B",
        genreVector: candidateVec,
        similarTracks: [{ artist: "Random", title: "Nothing", match: 0.7 }],
        similarArtists: [{ artist: "Unknown", match: 0.6 }],
        cfEnrichedAt: new Date(),
      },
      {
        title: "Not Enriched At All",
        artist: "Candidate C",
        genreVector: candidateVec,
      },
    ]);

    const result = await getRecommendations({
      profileVector: v(5), // pure jazz profiel
      dial: 3, // gebalanceerd: genre 0.5, cf 0.5
      userId,
    });

    const withOverlap = result.tracks.find((t) => t.track.title === "Enriched With Overlap");
    const noOverlap = result.tracks.find((t) => t.track.title === "Enriched No Overlap");
    const notEnriched = result.tracks.find((t) => t.track.title === "Not Enriched At All");

    assert.ok(withOverlap, "Enriched With Overlap gevonden");
    assert.ok(noOverlap, "Enriched No Overlap gevonden");
    assert.ok(notEnriched, "Not Enriched At All gevonden");

    // signals.cf is number voor enriched track met overlap
    assert.equal(
      typeof withOverlap.signals.cf,
      "number",
      "signals.cf is number voor enriched met overlap",
    );
    assert.ok(
      withOverlap.signals.cf > 0,
      `signals.cf (${withOverlap.signals.cf}) > 0 voor track met overlap`,
    );

    // signals.cf is null voor enriched track ZONDER overlap (geen matches met liked)
    assert.equal(
      noOverlap.signals.cf,
      null,
      "signals.cf is null voor enriched zonder overlap met liked tracks",
    );

    // signals.cf is null voor niet-enriched track (geen cfEnrichedAt)
    assert.equal(notEnriched.signals.cf, null, "signals.cf is null voor niet-enriched track");

    // Enriched met overlap moet hoger scoren (cf boost compenseert genre-only re-normalisatie)
    assert.ok(
      withOverlap.finalScore > noOverlap.finalScore,
      `Track met CF overlap (${withOverlap.finalScore}) moet hoger scoren dan zonder (${noOverlap.finalScore})`,
    );

    // activeSignals in meta moet "cf" bevatten (want minstens 1 track heeft cf score)
    assert.ok(
      result.meta.activeSignals.includes("cf"),
      "activeSignals bevat 'cf' wanneer enriched tracks met overlap aanwezig zijn",
    );
    assert.ok(result.meta.activeSignals.includes("genre"), "activeSignals bevat 'genre'");
  });
});
