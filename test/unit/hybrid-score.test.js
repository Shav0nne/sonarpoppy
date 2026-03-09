import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hybridScore, DEFAULT_WEIGHTS } from "../../src/services/scoring/hybridScore.js";

// REQ-001: Hybride scoring formule: (alpha*genre + beta*cf + gamma*audio) x delta*feedback
describe("hybridScore — formule", () => {
  it("berekent gewogen som × feedback multiplier met alle signalen", () => {
    const result = hybridScore(
      { genre: 0.8, cf: 0.6, audio: 0.5 },
      { genre: 0.3, cf: 0.4, audio: 0.3 },
      1.0,
    );
    // (0.3*0.8 + 0.4*0.6 + 0.3*0.5) × 1.0 = (0.24 + 0.24 + 0.15) × 1.0 = 0.63
    assert.equal(result.finalScore, 0.63);
  });

  it("feedback multiplier schaalt de score", () => {
    const result = hybridScore(
      { genre: 0.8, cf: 0.6, audio: 0.5 },
      { genre: 0.3, cf: 0.4, audio: 0.3 },
      1.2,
    );
    // 0.63 × 1.2 = 0.756
    const expected = +(0.63 * 1.2).toFixed(10);
    assert.equal(+result.finalScore.toFixed(10), expected);
  });

  it("retourneert signals object met originele scores", () => {
    const result = hybridScore(
      { genre: 0.8, cf: 0.6, audio: 0.5 },
      { genre: 0.3, cf: 0.4, audio: 0.3 },
      1.0,
    );
    assert.deepEqual(result.signals, { genre: 0.8, cf: 0.6, audio: 0.5 });
  });

  it("retourneert appliedWeights en feedbackMultiplier", () => {
    const result = hybridScore(
      { genre: 0.8, cf: 0.6, audio: 0.5 },
      { genre: 0.3, cf: 0.4, audio: 0.3 },
      1.1,
    );
    assert.deepEqual(result.appliedWeights, {
      genre: 0.3,
      cf: 0.4,
      audio: 0.3,
    });
    assert.equal(result.feedbackMultiplier, 1.1);
  });
});

// REQ-002: Pluggable signal interface — willekeurige combinatie van signalen werkt
describe("hybridScore — pluggable signals", () => {
  const weights = { genre: 0.3, cf: 0.4, audio: 0.3 };

  it("werkt met alleen genre signaal", () => {
    const result = hybridScore({ genre: 0.8, cf: null, audio: null }, weights);
    assert.equal(result.signals.genre, 0.8);
    assert.equal(result.signals.cf, null);
    assert.equal(result.signals.audio, null);
    assert.ok(result.finalScore > 0);
  });

  it("werkt met twee signalen (genre + audio)", () => {
    const result = hybridScore({ genre: 0.8, cf: null, audio: 0.5 }, weights);
    assert.equal(result.signals.genre, 0.8);
    assert.equal(result.signals.cf, null);
    assert.equal(result.signals.audio, 0.5);
    assert.ok(result.finalScore > 0);
  });

  it("werkt met undefined signals (impliciet null)", () => {
    const result = hybridScore({ genre: 0.7 }, weights);
    assert.equal(result.signals.genre, 0.7);
    assert.equal(result.signals.cf, null);
    assert.equal(result.signals.audio, null);
    assert.ok(result.finalScore > 0);
  });

  it("retourneert score 0 bij geen signalen", () => {
    const result = hybridScore({}, weights);
    assert.equal(result.finalScore, 0);
  });

  it("retourneert score 0 bij alle null signalen", () => {
    const result = hybridScore({ genre: null, cf: null, audio: null }, weights);
    assert.equal(result.finalScore, 0);
  });
});

// REQ-003: Re-normalisatie — gewichten proportioneel opgeschaald (som=1.0)
describe("hybridScore — re-normalisatie", () => {
  const weights = { genre: 0.3, cf: 0.4, audio: 0.3 };

  it("1 signaal: genre krijgt 100% gewicht", () => {
    const result = hybridScore({ genre: 0.8 }, weights);
    assert.equal(result.appliedWeights.genre, 1.0);
    assert.equal(result.appliedWeights.cf, 0);
    assert.equal(result.appliedWeights.audio, 0);
    // finalScore = 1.0 * 0.8 = 0.8
    assert.equal(result.finalScore, 0.8);
  });

  it("2 signalen: gewichten proportioneel verdeeld (som=1.0)", () => {
    const result = hybridScore({ genre: 1.0, cf: 1.0 }, weights);
    // genre=0.3, cf=0.4 → som=0.7 → genre=0.3/0.7, cf=0.4/0.7
    const expectedGenre = +(0.3 / 0.7).toFixed(10);
    const expectedCf = +(0.4 / 0.7).toFixed(10);
    assert.equal(+result.appliedWeights.genre.toFixed(10), expectedGenre);
    assert.equal(+result.appliedWeights.cf.toFixed(10), expectedCf);
    assert.equal(result.appliedWeights.audio, 0);
    // Som van applied weights = 1.0
    const weightSum =
      result.appliedWeights.genre + result.appliedWeights.cf + result.appliedWeights.audio;
    assert.equal(+weightSum.toFixed(10), 1.0);
  });

  it("3 signalen: originele gewichten behouden (al som=1.0)", () => {
    const result = hybridScore({ genre: 0.5, cf: 0.5, audio: 0.5 }, weights);
    assert.deepEqual(result.appliedWeights, {
      genre: 0.3,
      cf: 0.4,
      audio: 0.3,
    });
  });

  it("0 signalen: alle gewichten 0", () => {
    const result = hybridScore({}, weights);
    assert.deepEqual(result.appliedWeights, { genre: 0, cf: 0, audio: 0 });
  });
});

// REQ-004: Default gewichten Stand 3, configureerbaar via parameter
describe("hybridScore — default weights", () => {
  it("DEFAULT_WEIGHTS is Stand 3 Gebalanceerd", () => {
    assert.deepEqual(DEFAULT_WEIGHTS, { genre: 0.3, cf: 0.4, audio: 0.3 });
  });

  it("gebruikt Stand 3 defaults zonder weights parameter", () => {
    const result = hybridScore({ genre: 0.8, cf: 0.6, audio: 0.5 });
    // Zelfde als expliciete Stand 3 weights
    assert.deepEqual(result.appliedWeights, {
      genre: 0.3,
      cf: 0.4,
      audio: 0.3,
    });
    assert.equal(result.finalScore, 0.63);
  });

  it("override weights via parameter", () => {
    const custom = { genre: 0.5, cf: 0.2, audio: 0.3 };
    const result = hybridScore({ genre: 1.0, cf: 1.0, audio: 1.0 }, custom);
    assert.deepEqual(result.appliedWeights, custom);
  });

  it("default feedbackMultiplier is 1.0", () => {
    const result = hybridScore({ genre: 0.5 });
    assert.equal(result.feedbackMultiplier, 1.0);
  });

  it("DEFAULT_WEIGHTS is frozen (immutable)", () => {
    assert.ok(Object.isFrozen(DEFAULT_WEIGHTS));
  });
});
