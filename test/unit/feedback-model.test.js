import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Feedback from "../../src/models/Feedback.js";

const validFeedback = {
  userId: "user123",
  trackId: new mongoose.Types.ObjectId(),
  action: "like",
};

describe("Feedback schema velden", () => {
  it("heeft alle verwachte paden", () => {
    const paths = Object.keys(Feedback.schema.paths);
    const expected = [
      "userId",
      "trackId",
      "action",
      "playCount",
      "lastPlayedAt",
      "createdAt",
      "updatedAt",
      "_id",
      "__v",
    ];
    for (const field of expected) {
      assert.ok(paths.includes(field), `missing path: ${field}`);
    }
  });

  it("userId is required String", () => {
    const p = Feedback.schema.path("userId");
    assert.equal(p.options.type, String);
    assert.equal(p.options.required, true);
  });

  it("trackId is required ObjectId met ref Track", () => {
    const p = Feedback.schema.path("trackId");
    assert.equal(p.options.ref, "Track");
    assert.equal(p.options.required, true);
  });

  it("action is nullable String enum", () => {
    const p = Feedback.schema.path("action");
    assert.equal(p.options.type, String);
    assert.deepEqual(p.options.enum, ["like", "dislike", "library", "skip", null]);
  });

  it("playCount defaults to 0", () => {
    const p = Feedback.schema.path("playCount");
    assert.equal(p.options.type, Number);
    assert.equal(p.options.default, 0);
  });

  it("lastPlayedAt is Date", () => {
    const p = Feedback.schema.path("lastPlayedAt");
    assert.equal(p.options.type, Date);
  });

  it("timestamps zijn enabled", () => {
    assert.ok(Feedback.schema.paths.createdAt, "createdAt exists");
    assert.ok(Feedback.schema.paths.updatedAt, "updatedAt exists");
  });
});

describe("Feedback validatie", () => {
  it("accepteert geldige feedback met action", () => {
    const doc = new Feedback(validFeedback);
    const err = doc.validateSync();
    assert.equal(err, undefined);
  });

  it("accepteert feedback zonder action (null — pure play tracking)", () => {
    const doc = new Feedback({
      userId: "user123",
      trackId: new mongoose.Types.ObjectId(),
      action: null,
    });
    const err = doc.validateSync();
    assert.equal(err, undefined);
  });

  it("faalt bij ongeldige action", () => {
    const doc = new Feedback({ ...validFeedback, action: "love" });
    const err = doc.validateSync();
    assert.ok(err);
    assert.ok(err.errors.action);
  });

  it("accepteert alle geldige actions", () => {
    for (const action of ["like", "dislike", "library", "skip"]) {
      const doc = new Feedback({ ...validFeedback, action });
      const err = doc.validateSync();
      assert.equal(err, undefined, `${action} should be valid`);
    }
  });

  it("faalt zonder userId", () => {
    const doc = new Feedback({
      trackId: new mongoose.Types.ObjectId(),
      action: "like",
    });
    const err = doc.validateSync();
    assert.ok(err);
    assert.ok(err.errors.userId);
  });

  it("faalt zonder trackId", () => {
    const doc = new Feedback({ userId: "user123", action: "like" });
    const err = doc.validateSync();
    assert.ok(err);
    assert.ok(err.errors.trackId);
  });

  it("playCount default is 0 wanneer niet meegegeven", () => {
    const doc = new Feedback(validFeedback);
    assert.equal(doc.playCount, 0);
  });
});

describe("Feedback indexen", () => {
  it("heeft unique compound index op userId + trackId", () => {
    const indexes = Feedback.schema.indexes();
    const compound = indexes.find(([fields]) => fields.userId === 1 && fields.trackId === 1);
    assert.ok(compound, "compound index userId+trackId exists");
    assert.equal(compound[1].unique, true);
  });

  it("heeft index op userId", () => {
    const indexes = Feedback.schema.indexes();
    const userIdx = indexes.find(([fields]) => fields.userId === 1 && !fields.trackId);
    assert.ok(userIdx, "userId index exists");
  });

  it("heeft index op trackId", () => {
    const indexes = Feedback.schema.indexes();
    const trackIdx = indexes.find(([fields]) => fields.trackId === 1 && !fields.userId);
    assert.ok(trackIdx, "trackId index exists");
  });
});
