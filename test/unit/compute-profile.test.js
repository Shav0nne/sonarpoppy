import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeProfileVector } from "../../src/services/profile/computeProfile.js";
import { GENRE_COUNT } from "../../src/config/genres.js";

// REQ-001: Genre weights omzetten naar 20-dimensie vector
describe("computeProfileVector — genre weights naar vector", () => {
  it("plaatst rock weight op index 0 en jazz weight op index 5", () => {
    const result = computeProfileVector({ rock: 0.8, jazz: 0.2 });
    assert.equal(result.vector.length, GENRE_COUNT);
    assert.ok(result.vector[0] > 0, "rock (index 0) moet > 0 zijn");
    assert.ok(result.vector[5] > 0, "jazz (index 5) moet > 0 zijn");
  });

  it("zet niet-genoemde genres op 0", () => {
    const result = computeProfileVector({ rock: 1.0 });
    const nonRockValues = result.vector.filter((_, i) => i !== 0);
    assert.ok(
      nonRockValues.every((v) => v === 0),
      "alle niet-rock genres moeten 0 zijn",
    );
  });

  it("retourneert een array van exact 20 elementen", () => {
    const result = computeProfileVector({ pop: 0.5, metal: 0.5 });
    assert.equal(result.vector.length, 20);
  });
});

// REQ-002: Output vector is genormaliseerd
describe("computeProfileVector — normalisatie", () => {
  it("vector waarden tellen op tot 1.0", () => {
    const result = computeProfileVector({ rock: 0.8, jazz: 0.2 });
    const sum = result.vector.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.0001, `verwacht som ~1.0, kreeg ${sum}`);
  });

  it("normalisatie werkt ook bij ongelijke weights", () => {
    const result = computeProfileVector({ rock: 5, pop: 3, jazz: 2 });
    const sum = result.vector.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.0001, `verwacht som ~1.0, kreeg ${sum}`);
  });

  it("behoudt verhoudingen na normalisatie", () => {
    const result = computeProfileVector({ rock: 6, jazz: 3 });
    const ratio = result.vector[0] / result.vector[5];
    assert.ok(Math.abs(ratio - 2.0) < 0.0001, `verwacht ratio 2:1, kreeg ${ratio}`);
  });
});

// REQ-004: Cold start: equal weights bij lege input
describe("computeProfileVector — cold start", () => {
  it("geen argument → alle 20 genres op 1/20 (0.05)", () => {
    const result = computeProfileVector();
    assert.equal(result.vector.length, 20);
    for (const v of result.vector) {
      assert.ok(Math.abs(v - 0.05) < 0.0001, `verwacht 0.05, kreeg ${v}`);
    }
  });

  it("leeg object → equal weights", () => {
    const result = computeProfileVector({});
    for (const v of result.vector) {
      assert.ok(Math.abs(v - 0.05) < 0.0001, `verwacht 0.05, kreeg ${v}`);
    }
  });

  it("undefined → equal weights", () => {
    const result = computeProfileVector(undefined);
    const sum = result.vector.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.0001, `verwacht som ~1.0, kreeg ${sum}`);
  });
});

// REQ-005: Input validatie
describe("computeProfileVector — input validatie", () => {
  it("onbekende genre namen worden genegeerd", () => {
    const result = computeProfileVector({ rock: 0.8, "fake-genre": 0.5 });
    const sum = result.vector.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.0001, `verwacht som ~1.0, kreeg ${sum}`);
    assert.ok(result.vector[0] > 0, "rock moet aanwezig zijn");
  });

  it("negatieve waarden worden op 0 gezet", () => {
    const result = computeProfileVector({ rock: 0.8, jazz: -0.5 });
    assert.equal(result.vector[5], 0, "jazz (negatief) moet 0 zijn");
    assert.ok(result.vector[0] > 0, "rock moet positief zijn");
  });

  it("alleen onbekende genres → cold start (equal weights)", () => {
    const result = computeProfileVector({ "not-a-genre": 1.0, xyz: 0.5 });
    for (const v of result.vector) {
      assert.ok(Math.abs(v - 0.05) < 0.0001, `verwacht 0.05, kreeg ${v}`);
    }
  });
});

// REQ-003: Metadata in return object
describe("computeProfileVector — metadata", () => {
  it("retourneert meta.activeGenres als count van genres > 0", () => {
    const result = computeProfileVector({ rock: 0.8, jazz: 0.2 });
    assert.equal(result.meta.activeGenres, 2);
  });

  it("retourneert meta.topGenre als genre met hoogste waarde", () => {
    const result = computeProfileVector({ rock: 0.8, jazz: 0.2 });
    assert.equal(result.meta.topGenre, "rock");
  });

  it("cold start → activeGenres = 20, topGenre = null", () => {
    const result = computeProfileVector();
    assert.equal(result.meta.activeGenres, 20);
    assert.equal(result.meta.topGenre, null);
  });

  it("single genre → activeGenres = 1, topGenre = dat genre", () => {
    const result = computeProfileVector({ electronic: 1.0 });
    assert.equal(result.meta.activeGenres, 1);
    assert.equal(result.meta.topGenre, "electronic");
  });
});
