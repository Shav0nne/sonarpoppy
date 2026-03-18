import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Feedback from "../../src/models/Feedback.js";
import Track from "../../src/models/Track.js";
import { getRecommendations } from "../../src/services/recommendation/recommend.js";

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Feedback.syncIndexes();
  await Track.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Feedback.deleteMany({});
  await Track.deleteMany({});
});

const v = (primary) => {
  const vec = new Array(20).fill(0);
  vec[primary] = 1;
  return vec;
};

describe("Feedback CRUD — integration met MongoDB", () => {
  it("create feedback via Feedback.create en ophalen via find", async () => {
    const track = await Track.create({
      title: "Test Song",
      artist: "Test Artist",
      genreVector: v(0),
    });

    const feedback = await Feedback.create({
      userId: "user1",
      trackId: track._id,
      action: "like",
    });

    assert.equal(feedback.userId, "user1");
    assert.equal(feedback.action, "like");
    assert.equal(feedback.playCount, 0);

    const found = await Feedback.find({ userId: "user1" }).lean();
    assert.equal(found.length, 1);
    assert.equal(found[0].action, "like");
  });

  it("unique constraint op userId + trackId voorkomt duplicaten", async () => {
    const track = await Track.create({
      title: "Song",
      artist: "Artist",
      genreVector: v(0),
    });

    await Feedback.create({
      userId: "user1",
      trackId: track._id,
      action: "like",
    });

    await assert.rejects(
      () =>
        Feedback.create({
          userId: "user1",
          trackId: track._id,
          action: "dislike",
        }),
      (err) => err.code === 11000,
    );
  });

  it("findOneAndUpdate met upsert maakt of update feedback", async () => {
    const track = await Track.create({
      title: "Song",
      artist: "Artist",
      genreVector: v(0),
    });

    // Create via upsert
    const created = await Feedback.findOneAndUpdate(
      { userId: "user1", trackId: track._id },
      { action: "like" },
      { upsert: true, new: true, runValidators: true },
    );
    assert.equal(created.action, "like");

    // Update via upsert
    const updated = await Feedback.findOneAndUpdate(
      { userId: "user1", trackId: track._id },
      { action: "dislike" },
      { upsert: true, new: true, runValidators: true },
    );
    assert.equal(updated.action, "dislike");
    assert.equal(String(updated._id), String(created._id));
  });

  it("play count increment met $inc en lastPlayedAt update", async () => {
    const track = await Track.create({
      title: "Song",
      artist: "Artist",
      genreVector: v(0),
    });

    const doc = await Feedback.findOneAndUpdate(
      { userId: "user1", trackId: track._id },
      { $inc: { playCount: 1 }, lastPlayedAt: new Date() },
      { upsert: true, new: true },
    );

    assert.equal(doc.playCount, 1);
    assert.ok(doc.lastPlayedAt);

    // Tweede play
    const doc2 = await Feedback.findOneAndUpdate(
      { userId: "user1", trackId: track._id },
      { $inc: { playCount: 1 }, lastPlayedAt: new Date() },
      { new: true },
    );
    assert.equal(doc2.playCount, 2);
  });

  it("delete feedback verwijdert document", async () => {
    const track = await Track.create({
      title: "Song",
      artist: "Artist",
      genreVector: v(0),
    });

    await Feedback.create({
      userId: "user1",
      trackId: track._id,
      action: "like",
    });

    const result = await Feedback.deleteOne({
      userId: "user1",
      trackId: track._id,
    });
    assert.equal(result.deletedCount, 1);

    const remaining = await Feedback.find({ userId: "user1" }).lean();
    assert.equal(remaining.length, 0);
  });

  it("feedback zonder action (pure play tracking) is geldig", async () => {
    const track = await Track.create({
      title: "Song",
      artist: "Artist",
      genreVector: v(0),
    });

    const doc = await Feedback.create({
      userId: "user1",
      trackId: track._id,
      action: null,
    });

    assert.equal(doc.action, null);
    assert.equal(doc.playCount, 0);
  });
});

describe("Feedback pipeline integratie — recommendations met userId", () => {
  it("liked track krijgt feedbackMultiplier > 1.0", async () => {
    const track = await Track.create({
      title: "Liked Song",
      artist: "Artist",
      genreVector: v(0),
    });

    await Feedback.create({
      userId: "user1",
      trackId: track._id,
      action: "like",
    });

    const result = await getRecommendations({
      profileVector: v(0),
      userId: "user1",
    });

    assert.equal(result.tracks.length, 1);
    assert.equal(result.tracks[0].feedbackMultiplier, 1.1);
    assert.ok(result.tracks[0].finalScore > 0);
  });

  it("disliked track krijgt feedbackMultiplier 0.5", async () => {
    const track = await Track.create({
      title: "Disliked Song",
      artist: "Artist",
      genreVector: v(0),
    });

    await Feedback.create({
      userId: "user1",
      trackId: track._id,
      action: "dislike",
    });

    const result = await getRecommendations({
      profileVector: v(0),
      userId: "user1",
    });

    assert.equal(result.tracks[0].feedbackMultiplier, 0.5);
  });

  it("track zonder feedback krijgt feedbackMultiplier 1.0", async () => {
    await Track.create({
      title: "Neutral Song",
      artist: "Artist",
      genreVector: v(0),
    });

    const result = await getRecommendations({
      profileVector: v(0),
      userId: "user1",
    });

    assert.equal(result.tracks[0].feedbackMultiplier, 1.0);
  });

  it("zonder userId werkt pipeline als voorheen (multiplier=1.0)", async () => {
    const track = await Track.create({
      title: "Song",
      artist: "Artist",
      genreVector: v(0),
    });

    await Feedback.create({
      userId: "user1",
      trackId: track._id,
      action: "like",
    });

    // Geen userId → feedback wordt niet opgehaald
    const result = await getRecommendations({ profileVector: v(0) });
    assert.equal(result.tracks[0].feedbackMultiplier, 1.0);
  });
});
