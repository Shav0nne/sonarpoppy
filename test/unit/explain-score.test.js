import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Track from "../../src/models/Track.js";
import Feedback from "../../src/models/Feedback.js";
import AlgorithmConfig from "../../src/models/AlgorithmConfig.js";
import { explainTrackScore } from "../../src/services/admin/explainScore.js";

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

beforeEach(async () => {
  await Track.deleteMany({});
  await Feedback.deleteMany({});
  await AlgorithmConfig.deleteMany({});
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const userId = "test-user-1";

describe("explainTrackScore", () => {
  it("retourneert null voor onbekend trackId", async () => {
    const result = await explainTrackScore(new mongoose.Types.ObjectId(), userId);
    assert.equal(result, null);
  });

  it("retourneert volledige breakdown voor bestaand track", async () => {
    const gv = new Array(20).fill(0);
    gv[0] = 1;
    const track = await Track.create({
      title: "Test Track",
      artist: "Test Artist",
      genreVector: gv,
    });

    const result = await explainTrackScore(track._id, userId);
    assert.ok(result);
    assert.equal(result.track.title, "Test Track");
    assert.equal(result.track.artist, "Test Artist");
    assert.equal(typeof result.genreScore, "number");
    assert.equal(typeof result.finalScore, "number");
    assert.equal(typeof result.feedbackMultiplier, "number");
    assert.equal(result.feedbackAction, null);
    assert.ok("hybridWeights" in result);
    assert.ok("bubbleFilter" in result);
    assert.ok("cfDetail" in result);
  });

  it("bevat feedback action als gebruiker feedback heeft", async () => {
    const gv = new Array(20).fill(0);
    gv[0] = 1;
    const track = await Track.create({
      title: "Liked Track",
      artist: "Band",
      genreVector: gv,
    });
    await Feedback.create({ userId, trackId: track._id, action: "like" });

    const result = await explainTrackScore(track._id, userId);
    assert.equal(result.feedbackAction, "like");
    assert.ok(result.feedbackMultiplier > 1.0);
  });

  it("bubbleFilter bevat dial, threshold, passes", async () => {
    const gv = new Array(20).fill(0);
    gv[0] = 1;
    const track = await Track.create({
      title: "Track",
      artist: "A",
      genreVector: gv,
    });

    const result = await explainTrackScore(track._id, userId);
    assert.equal(result.bubbleFilter.dial, 3);
    assert.equal(result.bubbleFilter.threshold, null);
    assert.equal(result.bubbleFilter.passes, true);
  });

  it("cfDetail bevat trackOverlap, artistOverlap, enrichedAt", async () => {
    const gv = new Array(20).fill(0);
    gv[0] = 1;
    const track = await Track.create({
      title: "Track",
      artist: "A",
      genreVector: gv,
    });

    const result = await explainTrackScore(track._id, userId);
    assert.equal(result.cfDetail.trackOverlap, 0);
    assert.equal(result.cfDetail.artistOverlap, 0);
    assert.equal(result.cfDetail.enrichedAt, null);
  });

  it("gebruikt AlgorithmConfig waarden uit DB", async () => {
    const gv = new Array(20).fill(0);
    gv[0] = 1;
    const track = await Track.create({
      title: "Track",
      artist: "A",
      genreVector: gv,
    });

    // Create custom config
    await AlgorithmConfig.create({
      hybridWeights: { genre: 0.8, cf: 0.2 },
    });

    const result = await explainTrackScore(track._id, userId);
    assert.deepEqual(result.hybridWeights, { genre: 0.8, cf: 0.2 });
  });
});
