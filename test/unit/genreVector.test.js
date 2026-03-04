import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createVector, normalizeVector } from "../../src/utils/genreVector.js";
import { GENRE_COUNT } from "../../src/config/genres.js";

// REQ-004: normalizeVector
describe("normalizeVector", () => {
  it("normaliseert zodat waarden optellen tot 1.0", () => {
    const result = normalizeVector([2, 3, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const sum = result.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.0001, `sum should be ~1.0, got ${sum}`);
  });

  it("behoudt verhoudingen na normalisatie", () => {
    const result = normalizeVector([2, 3, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.ok(Math.abs(result[0] - 0.2) < 0.0001);
    assert.ok(Math.abs(result[1] - 0.3) < 0.0001);
    assert.ok(Math.abs(result[2] - 0.5) < 0.0001);
  });

  it("retourneert zero-vector voor zero-vector input", () => {
    const zeros = new Array(GENRE_COUNT).fill(0);
    const result = normalizeVector(zeros);
    assert.deepEqual(result, zeros);
  });

  it("retourneert array van correcte lengte", () => {
    const input = new Array(GENRE_COUNT).fill(1);
    const result = normalizeVector(input);
    assert.equal(result.length, GENRE_COUNT);
  });
});

// REQ-003: createVector
describe("createVector", () => {
  it("maakt vector van 20 floats uit tags", () => {
    const result = createVector(["rock", "pop"]);
    assert.equal(result.length, GENRE_COUNT);
  });

  it("mapt bekende tags naar correcte genre posities", () => {
    const result = createVector(["rock"]);
    assert.ok(result[0] > 0, "rock (index 0) zou > 0 moeten zijn");
  });

  it("verdeelt gewicht over meerdere tags van zelfde genre", () => {
    const result = createVector(["rock", "classic rock", "hard rock"]);
    assert.ok(result[0] > 0, "rock index zou gewicht moeten hebben");
    const sum = result.reduce((a, b) => a + b, 0);
    assert.ok(
      Math.abs(sum - 1.0) < 0.0001,
      `vector zou genormaliseerd moeten zijn, got sum ${sum}`,
    );
  });

  it("verdeelt gewicht over meerdere genres", () => {
    const result = createVector(["rock", "jazz"]);
    assert.ok(result[0] > 0, "rock zou gewicht moeten hebben");
    assert.ok(result[5] > 0, "jazz zou gewicht moeten hebben");
  });

  it("negeert onbekende tags", () => {
    const withUnknown = createVector(["rock", "onzintag", "jazz"]);
    assert.ok(withUnknown[0] > 0, "rock zou gewicht moeten hebben");
    assert.ok(withUnknown[5] > 0, "jazz zou gewicht moeten hebben");
  });

  it("output is genormaliseerd (sum ≈ 1.0)", () => {
    const result = createVector(["techno", "hip hop", "jazz"]);
    const sum = result.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.0001, `sum should be ~1.0, got ${sum}`);
  });

  it("resolved aliases correct", () => {
    const result = createVector(["techno"]);
    assert.ok(result[2] > 0, "techno → electronic (index 2) zou > 0 moeten zijn");
  });
});

// REQ-005: Zero-vector guard
describe("zero-vector guard", () => {
  it("lege tags array → zero-vector", () => {
    const result = createVector([]);
    assert.equal(result.length, GENRE_COUNT);
    assert.ok(
      result.every((v) => v === 0),
      "alle waarden moeten 0 zijn",
    );
  });

  it("null input → zero-vector", () => {
    const result = createVector(null);
    assert.equal(result.length, GENRE_COUNT);
    assert.ok(result.every((v) => v === 0));
  });

  it("undefined input → zero-vector", () => {
    const result = createVector(undefined);
    assert.equal(result.length, GENRE_COUNT);
    assert.ok(result.every((v) => v === 0));
  });

  it("alle-onbekende tags → zero-vector", () => {
    const result = createVector(["xyzgenre", "abcgenre", "onbekend"]);
    assert.equal(result.length, GENRE_COUNT);
    assert.ok(
      result.every((v) => v === 0),
      "geen bekende genres → zero-vector",
    );
  });

  it("crashed niet bij lege of ongeldige input", () => {
    assert.doesNotThrow(() => createVector([]));
    assert.doesNotThrow(() => createVector(null));
    assert.doesNotThrow(() => createVector(undefined));
    assert.doesNotThrow(() => createVector([null, 42, undefined]));
  });
});
