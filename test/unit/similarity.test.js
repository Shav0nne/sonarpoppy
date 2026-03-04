import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cosineSimilarity } from "../../src/utils/similarity.js";

// REQ-004: Ongelijke vectorlengtes → Error
describe("cosineSimilarity — input validatie: lengte", () => {
  it("gooit Error bij ongelijke vectorlengtes", () => {
    assert.throws(() => cosineSimilarity([1, 2], [1, 2, 3]), {
      name: "Error",
    });
  });

  it("gooit Error bij lege vector vs gevulde vector", () => {
    assert.throws(() => cosineSimilarity([], [1, 2]), {
      name: "Error",
    });
  });
});

// REQ-005: Niet-numerieke waarden → TypeError
describe("cosineSimilarity — input validatie: type", () => {
  it("gooit TypeError bij string waarde in vector", () => {
    assert.throws(() => cosineSimilarity(["a", 1], [1, 2]), {
      name: "TypeError",
    });
  });

  it("gooit TypeError bij null waarde in vector", () => {
    assert.throws(() => cosineSimilarity([null, 1], [1, 2]), {
      name: "TypeError",
    });
  });

  it("gooit TypeError bij undefined waarde in vector", () => {
    assert.throws(() => cosineSimilarity([undefined, 1], [1, 2]), {
      name: "TypeError",
    });
  });

  it("gooit TypeError bij niet-array input", () => {
    assert.throws(() => cosineSimilarity("abc", [1, 2]), {
      name: "TypeError",
    });
  });
});

// REQ-002: Zero-vector guard
describe("cosineSimilarity — zero-vector guard", () => {
  it("retourneert 0 als eerste vector zero-vector is", () => {
    assert.equal(cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
  });

  it("retourneert 0 als tweede vector zero-vector is", () => {
    assert.equal(cosineSimilarity([1, 2, 3], [0, 0, 0]), 0);
  });

  it("retourneert 0 als beide vectoren zero-vector zijn", () => {
    assert.equal(cosineSimilarity([0, 0, 0], [0, 0, 0]), 0);
  });

  it("retourneert 0 voor lege vectoren", () => {
    assert.equal(cosineSimilarity([], []), 0);
  });
});

// REQ-001: Core cosine similarity
describe("cosineSimilarity — core berekening", () => {
  it("retourneert 1.0 voor identieke vectoren", () => {
    assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
  });

  it("retourneert 0.0 voor orthogonale vectoren", () => {
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  });

  it("berekent correcte similarity voor bekende waarden", () => {
    // cos([1,2,3], [4,5,6]) = 32 / (sqrt(14) * sqrt(77)) ≈ 0.9746
    const result = cosineSimilarity([1, 2, 3], [4, 5, 6]);
    assert.ok(Math.abs(result - 0.9746) < 0.001, `expected ~0.9746, got ${result}`);
  });

  it("retourneert waarde tussen 0 en 1", () => {
    const result = cosineSimilarity([1, 2, 0], [0, 1, 2]);
    assert.ok(result >= 0 && result <= 1, `expected 0-1, got ${result}`);
  });
});

// REQ-003: Magnitude-normalisatie (inherent aan cosine formule)
describe("cosineSimilarity — magnitude-normalisatie", () => {
  it("geschaalde vectoren geven zelfde resultaat als origineel", () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    const aScaled = [10, 20, 30];
    const bScaled = [40, 50, 60];

    const original = cosineSimilarity(a, b);
    const scaled = cosineSimilarity(aScaled, bScaled);

    assert.ok(
      Math.abs(original - scaled) < 0.0001,
      `expected same result, got ${original} vs ${scaled}`,
    );
  });

  it("genormaliseerde en niet-genormaliseerde input geven zelfde score", () => {
    const a = [3, 4];
    const b = [1, 0];
    const aNorm = [0.6, 0.8]; // 3/5, 4/5

    const result1 = cosineSimilarity(a, b);
    const result2 = cosineSimilarity(aNorm, b);

    assert.ok(
      Math.abs(result1 - result2) < 0.0001,
      `expected same result, got ${result1} vs ${result2}`,
    );
  });
});
