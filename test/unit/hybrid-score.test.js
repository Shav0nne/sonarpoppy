import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hybridScore, DEFAULT_WEIGHTS } from "../../src/services/scoring/hybridScore.js";

// REQ-001: Hybride scoring formule: (alpha*genre + beta*cf) x delta*feedback
describe("hybridScore — formule", () => {
  it("berekent gewogen som × feedback multiplier met alle signalen", () => {
    const result = hybridScore({ genre: 0.8, cf: 0.6 }, { genre: 0.5, cf: 0.5 }, 1.0);
    // (0.5*0.8 + 0.5*0.6) × 1.0 = (0.4 + 0.3) × 1.0 = 0.7
    assert.equal(result.finalScore, 0.7);
  });

  it("feedback multiplier schaalt de score", () => {
    const result = hybridScore({ genre: 0.8, cf: 0.6 }, { genre: 0.5, cf: 0.5 }, 1.2);
    // 0.7 × 1.2 = 0.84
    const expected = +(0.7 * 1.2).toFixed(10);
    assert.equal(+result.finalScore.toFixed(10), expected);
  });

  it("retourneert signals object met originele scores", () => {
    const result = hybridScore({ genre: 0.8, cf: 0.6 }, { genre: 0.5, cf: 0.5 }, 1.0);
    assert.deepEqual(result.signals, { genre: 0.8, cf: 0.6 });
  });

  it("retourneert appliedWeights en feedbackMultiplier", () => {
    const result = hybridScore({ genre: 0.8, cf: 0.6 }, { genre: 0.5, cf: 0.5 }, 1.1);
    assert.deepEqual(result.appliedWeights, {
      genre: 0.5,
      cf: 0.5,
    });
    assert.equal(result.feedbackMultiplier, 1.1);
  });
});

// REQ-002: Pluggable signal interface — willekeurige combinatie van signalen werkt
describe("hybridScore — pluggable signals", () => {
  const weights = { genre: 0.5, cf: 0.5 };

  it("werkt met alleen genre signaal", () => {
    const result = hybridScore({ genre: 0.8, cf: null }, weights);
    assert.equal(result.signals.genre, 0.8);
    assert.equal(result.signals.cf, null);
    assert.ok(result.finalScore > 0);
  });

  it("werkt met undefined signals (impliciet null)", () => {
    const result = hybridScore({ genre: 0.7 }, weights);
    assert.equal(result.signals.genre, 0.7);
    assert.equal(result.signals.cf, null);
    assert.ok(result.finalScore > 0);
  });

  it("retourneert score 0 bij geen signalen", () => {
    const result = hybridScore({}, weights);
    assert.equal(result.finalScore, 0);
  });

  it("retourneert score 0 bij alle null signalen", () => {
    const result = hybridScore({ genre: null, cf: null }, weights);
    assert.equal(result.finalScore, 0);
  });
});

// REQ-003: Re-normalisatie — gewichten proportioneel opgeschaald (som=1.0)
describe("hybridScore — re-normalisatie", () => {
  const weights = { genre: 0.5, cf: 0.5 };

  it("1 signaal: genre krijgt 100% gewicht", () => {
    const result = hybridScore({ genre: 0.8 }, weights);
    assert.equal(result.appliedWeights.genre, 1.0);
    assert.equal(result.appliedWeights.cf, 0);
    // finalScore = 1.0 * 0.8 = 0.8
    assert.equal(result.finalScore, 0.8);
  });

  it("2 signalen: originele gewichten behouden (al som=1.0)", () => {
    const result = hybridScore({ genre: 0.5, cf: 0.5 }, weights);
    assert.deepEqual(result.appliedWeights, {
      genre: 0.5,
      cf: 0.5,
    });
  });

  it("0 signalen: alle gewichten 0", () => {
    const result = hybridScore({}, weights);
    assert.deepEqual(result.appliedWeights, { genre: 0, cf: 0 });
  });
});

// REQ-004: Default gewichten Stand 3, configureerbaar via parameter
describe("hybridScore — default weights", () => {
  it("DEFAULT_WEIGHTS is Stand 3 Gebalanceerd", () => {
    assert.deepEqual(DEFAULT_WEIGHTS, { genre: 0.5, cf: 0.5 });
  });

  it("gebruikt Stand 3 defaults zonder weights parameter", () => {
    const result = hybridScore({ genre: 0.8, cf: 0.6 });
    // Zelfde als expliciete Stand 3 weights
    assert.deepEqual(result.appliedWeights, {
      genre: 0.5,
      cf: 0.5,
    });
    assert.equal(result.finalScore, 0.7);
  });

  it("override weights via parameter", () => {
    const custom = { genre: 0.7, cf: 0.3 };
    const result = hybridScore({ genre: 1.0, cf: 1.0 }, custom);
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
