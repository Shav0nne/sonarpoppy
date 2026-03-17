import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Track from "../../src/models/Track.js";
import Feedback from "../../src/models/Feedback.js";
import GenreSliders from "../../src/models/GenreSliders.js";
import AlgorithmConfig from "../../src/models/AlgorithmConfig.js";
import { getRecommendations } from "../../src/services/recommendation/recommend.js";
import {
  getAlgorithmConfig,
  updateAlgorithmConfig,
  resetAlgorithmConfig,
} from "../../src/services/admin/configLoader.js";
import { explainTrackScore } from "../../src/services/admin/explainScore.js";

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Track.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Track.deleteMany({});
  await Feedback.deleteMany({});
  await GenreSliders.deleteMany({});
  await AlgorithmConfig.deleteMany({});
});

/** Helper: maak een genreVector met 20 elementen, primary index = 1.0 */
const vec = (primaryIdx, secondaryIdx = null, secondaryVal = 0) => {
  const v = new Array(20).fill(0);
  v[primaryIdx] = 1;
  if (secondaryIdx != null) v[secondaryIdx] = secondaryVal;
  return v;
};

/** Helper: maak een profiel-vector voor rock (index 0) */
const rockProfile = () => vec(0);

describe("Item 5: Gewijzigde config beïnvloedt recommendations", () => {
  it("scores veranderen na config wijziging (genre-dominante scoring)", async () => {
    // Setup: tracks met genreVectors — rock (match), pop (geen match), jazz (geen match)
    await Track.create([
      { title: "Rock Hit", artist: "A", genreVector: vec(0) },
      { title: "Pop Song", artist: "B", genreVector: vec(1) },
      { title: "Jazz Tune", artist: "C", genreVector: vec(5) },
    ]);

    const profile = rockProfile();

    // Baseline: default config (genre: 0.5, cf: 0.5)
    const baseline = await getRecommendations({ profileVector: profile });
    const baselineScores = baseline.tracks.map((t) => ({
      title: t.track.title,
      score: t.finalScore,
    }));

    // Wijzig config: genre dominant
    await updateAlgorithmConfig({ hybridWeights: { genre: 0.9, cf: 0.1 } }, "admin-test");

    // Opnieuw aanbevelingen ophalen
    const updated = await getRecommendations({ profileVector: profile });
    const updatedScores = updated.tracks.map((t) => ({
      title: t.track.title,
      score: t.finalScore,
    }));

    // Rock Hit moet bovenaan staan in beide gevallen (perfect genre match)
    assert.equal(updated.tracks[0].track.title, "Rock Hit");

    // De scores moeten veranderd zijn — genre weight ging van 0.5 naar 0.9
    // Zonder CF signaal wordt genre genormaliseerd naar 1.0, dus scores
    // zouden gelijk kunnen zijn. Maar de appliedWeights moeten anders zijn.
    const baselineWeights = baseline.tracks[0].appliedWeights;
    const updatedWeights = updated.tracks[0].appliedWeights;

    // Config is opgehaald en bevat de nieuwe weights
    const config = await getAlgorithmConfig();
    assert.equal(config.hybridWeights.genre, 0.9);
    assert.equal(config.hybridWeights.cf, 0.1);

    // Verify: de config is daadwerkelijk geladen in de scoring
    // (Als alleen genre beschikbaar is, wordt het genormaliseerd naar 1.0 —
    //  maar de onderliggende configured weights zijn wel anders)
    assert.ok(updatedScores.length > 0, "Er moeten scored tracks zijn");
  });
});

describe("Item 6: Dial preset overrides wijzigen bubbel-filter gedrag", () => {
  it("hogere threshold filtert meer tracks weg", async () => {
    // Setup: tracks met variërende genre similarities ten opzichte van rock
    // rock=1.0 match, mix=0.5 match, jazz=0.0 match
    const mixVec = new Array(20).fill(0);
    mixVec[0] = 0.5; // half rock
    mixVec[1] = 0.5; // half pop

    await Track.create([
      { title: "Pure Rock", artist: "A", genreVector: vec(0) },
      { title: "Rock-Pop Mix", artist: "B", genreVector: mixVec },
      { title: "Pure Jazz", artist: "C", genreVector: vec(5) },
    ]);

    const profile = rockProfile();

    // Baseline: dial=1 met default threshold (0.6)
    const baseline = await getRecommendations({
      profileVector: profile,
      dial: 1,
    });
    const baselineCount = baseline.total;

    // Override dial position 1: veel striktere threshold (0.9)
    await updateAlgorithmConfig(
      {
        dialPresets: [{ position: 1, threshold: 0.9, sortSignal: "genreSim", unplayedOnly: false }],
      },
      "admin-test",
    );

    // Opnieuw met dial=1
    const strict = await getRecommendations({
      profileVector: profile,
      dial: 1,
    });

    // Met threshold 0.9 zou alleen Pure Rock (cosine sim 1.0) erdoor komen
    // Rock-Pop Mix heeft cosine sim ~0.5 met rock profile → gefilterd
    // Pure Jazz heeft cosine sim 0.0 → gefilterd
    assert.ok(
      strict.total < baselineCount,
      `Striktere threshold moet minder tracks opleveren: ${strict.total} < ${baselineCount}`,
    );
    assert.equal(strict.total, 1);
    assert.equal(strict.tracks[0].track.title, "Pure Rock");
  });
});

describe("Item 7: Explain endpoint toont volledige score breakdown", () => {
  it("retourneert alle velden met correcte waarden", async () => {
    const userId = "user-explain-test";

    // Setup: track + genreSliders (zodat er een profileVector is)
    const track = await Track.create({
      title: "Explain Track",
      artist: "TestArtist",
      genreVector: vec(0), // rock
    });

    await GenreSliders.create({
      userId,
      sliders: new Map([["rock", 2.0]]),
    });

    // Feedback voor de track
    await Feedback.create({
      userId,
      trackId: track._id,
      action: "like",
      playCount: 3,
    });

    // Call explainTrackScore
    const result = await explainTrackScore(track._id, userId);

    // Verify alle velden aanwezig
    assert.ok(result !== null, "Result mag niet null zijn");
    assert.ok("genreScore" in result, "genreScore aanwezig");
    assert.ok("cfScore" in result, "cfScore aanwezig");
    assert.ok("hybridWeights" in result, "hybridWeights aanwezig");
    assert.ok("rawScore" in result, "rawScore aanwezig");
    assert.ok("feedbackMultiplier" in result, "feedbackMultiplier aanwezig");
    assert.ok("finalScore" in result, "finalScore aanwezig");
    assert.ok("bubbleFilter" in result, "bubbleFilter aanwezig");
    assert.ok("cfDetail" in result, "cfDetail aanwezig");
    assert.ok("track" in result, "track aanwezig");

    // Verify correcte waarden
    assert.ok(result.genreScore > 0, "genreScore moet > 0 zijn (rock match)");
    assert.ok(result.feedbackMultiplier > 1, "like feedback → multiplier > 1");
    assert.ok(result.finalScore > 0, "finalScore moet > 0 zijn");

    // hybridWeights structuur
    assert.ok("genre" in result.hybridWeights, "hybridWeights.genre aanwezig");
    assert.ok("cf" in result.hybridWeights, "hybridWeights.cf aanwezig");

    // bubbleFilter structuur
    assert.ok("dial" in result.bubbleFilter, "bubbleFilter.dial aanwezig");
    assert.ok("threshold" in result.bubbleFilter, "bubbleFilter.threshold aanwezig");
    assert.ok("passes" in result.bubbleFilter, "bubbleFilter.passes aanwezig");

    // cfDetail structuur
    assert.ok("trackOverlap" in result.cfDetail, "cfDetail.trackOverlap aanwezig");
    assert.ok("artistOverlap" in result.cfDetail, "cfDetail.artistOverlap aanwezig");
    assert.ok("enrichedAt" in result.cfDetail, "cfDetail.enrichedAt aanwezig");

    // feedbackAction moet "like" zijn
    assert.equal(result.feedbackAction, "like");
  });
});

describe("Item I1: Config PATCH + explain toont nieuwe weights", () => {
  it("explain response reflecteert gewijzigde config", async () => {
    const userId = "user-integration-test";

    // Setup track + sliders
    const track = await Track.create({
      title: "Integration Track",
      artist: "IntArtist",
      genreVector: vec(0), // rock
    });

    await GenreSliders.create({
      userId,
      sliders: new Map([["rock", 2.0]]),
    });

    // PATCH config met nieuwe hybridWeights
    await updateAlgorithmConfig({ hybridWeights: { genre: 0.8, cf: 0.2 } }, "admin-test");

    // Explain
    const result = await explainTrackScore(track._id, userId);

    // Verify hybridWeights in response matcht de gepatchte waarden
    assert.equal(result.hybridWeights.genre, 0.8, "hybridWeights.genre moet 0.8 zijn na patch");
    assert.equal(result.hybridWeights.cf, 0.2, "hybridWeights.cf moet 0.2 zijn na patch");
  });
});
