import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getFeedbackMultiplier } from "../../src/services/feedback/feedbackMultiplier.js";

describe("getFeedbackMultiplier — action mapping", () => {
  it("like retourneert 1.1", () => {
    assert.equal(getFeedbackMultiplier({ action: "like" }), 1.1);
  });

  it("dislike retourneert 0.5", () => {
    assert.equal(getFeedbackMultiplier({ action: "dislike" }), 0.5);
  });

  it("library retourneert 1.2", () => {
    assert.equal(getFeedbackMultiplier({ action: "library" }), 1.2);
  });

  it("skip retourneert 0.9", () => {
    assert.equal(getFeedbackMultiplier({ action: "skip" }), 0.9);
  });

  it("null action retourneert 1.0", () => {
    assert.equal(getFeedbackMultiplier({ action: null }), 1.0);
  });

  it("undefined action retourneert 1.0", () => {
    assert.equal(getFeedbackMultiplier({}), 1.0);
  });

  it("null input retourneert 1.0", () => {
    assert.equal(getFeedbackMultiplier(null), 1.0);
  });

  it("undefined input retourneert 1.0", () => {
    assert.equal(getFeedbackMultiplier(undefined), 1.0);
  });
});

describe("getFeedbackMultiplier — play count bonus", () => {
  const now = new Date();

  it("play count < 10 geeft geen bonus", () => {
    const result = getFeedbackMultiplier({
      action: "like",
      playCount: 9,
      lastPlayedAt: now,
    });
    assert.equal(result, 1.1);
  });

  it("play count 10+ met recente lastPlayedAt geeft ~1.05 extra", () => {
    const result = getFeedbackMultiplier({
      action: null,
      playCount: 10,
      lastPlayedAt: now,
    });
    // 1.0 (no action) × 1.05 (play bonus) ≈ 1.05
    assert.ok(result > 1.04 && result <= 1.05, `expected ~1.05, got ${result}`);
  });

  it("play count 10+ combineert met action multiplier", () => {
    const result = getFeedbackMultiplier({
      action: "like",
      playCount: 15,
      lastPlayedAt: now,
    });
    // 1.1 (like) × 1.05 (play bonus, decayed ~0) ≈ 1.155
    assert.ok(result > 1.14 && result <= 1.155, `expected ~1.155, got ${result}`);
  });

  it("play count bonus decays na 30 dagen (halfwaardetijd)", () => {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const result = getFeedbackMultiplier({
      action: null,
      playCount: 10,
      lastPlayedAt: thirtyDaysAgo,
    });
    // 1.0 × (1 + 0.05 × 0.5) = 1.025
    assert.ok(result > 1.02 && result < 1.03, `expected ~1.025, got ${result}`);
  });

  it("play count bonus decays verder na 60 dagen", () => {
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const result = getFeedbackMultiplier({
      action: null,
      playCount: 10,
      lastPlayedAt: sixtyDaysAgo,
    });
    // 1.0 × (1 + 0.05 × 0.25) = 1.0125
    assert.ok(result > 1.01 && result < 1.02, `expected ~1.0125, got ${result}`);
  });

  it("geen lastPlayedAt bij play count 10+ geeft geen bonus", () => {
    const result = getFeedbackMultiplier({
      action: null,
      playCount: 10,
    });
    assert.equal(result, 1.0);
  });

  it("play count 0 geeft geen bonus", () => {
    const result = getFeedbackMultiplier({
      action: null,
      playCount: 0,
      lastPlayedAt: now,
    });
    assert.equal(result, 1.0);
  });
});
