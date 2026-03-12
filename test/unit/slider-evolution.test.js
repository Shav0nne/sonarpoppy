import { describe, it } from "node:test";
import assert from "node:assert";
import { GENRES, GENRE_INDEX } from "../../src/config/genres.js";

/**
 * Helper: bouw een genreVector met specifieke genres op bepaalde waarden.
 * Niet-genoemde genres krijgen 0.
 */
function makeGenreVector(configs) {
  const vec = new Array(GENRES.length).fill(0);
  for (const [name, val] of Object.entries(configs)) {
    const idx = GENRE_INDEX[name];
    if (idx !== undefined) vec[idx] = val;
  }
  return vec;
}

describe("sliderEvolution — evolveSliders", () => {
  // Dynamic import zodat we de module pas laden als deze bestaat
  let evolveSliders;

  it("should load the module", async () => {
    const mod = await import("../../src/services/feedback/sliderEvolution.js");
    evolveSliders = mod.evolveSliders;
    assert.ok(typeof evolveSliders === "function", "evolveSliders should be a function");
  });

  it("REQ-005: should use evolveProfileWeights to compute evolved weights", async () => {
    if (!evolveSliders) {
      const mod = await import("../../src/services/feedback/sliderEvolution.js");
      evolveSliders = mod.evolveSliders;
    }

    const sliders = new Map([
      ["rock", 1.0],
      ["pop", 0.5],
      ["jazz", 0.8],
    ]);
    const locked = [];
    const trackGenreVector = makeGenreVector({ rock: 0.8, pop: 0.2 });

    const result = evolveSliders({
      currentSliders: sliders,
      locked,
      trackGenreVector,
      action: "like",
    });

    // like = +0.1 (ACTION_WEIGHTS)
    // rock: 1.0 + 0.8*0.1 = 1.08
    // pop: 0.5 + 0.2*0.1 = 0.52
    // jazz: 0.8 + 0*0.1 = 0.8 (unchanged — vector is 0)
    assert.ok(result.sliders instanceof Map, "should return a Map");
    assert.strictEqual(Math.round(result.sliders.get("rock") * 100) / 100, 1.08);
    assert.strictEqual(Math.round(result.sliders.get("pop") * 100) / 100, 0.52);
    assert.strictEqual(result.sliders.get("jazz"), 0.8);
  });

  it("REQ-003: should clamp evolved weights at minimum 0.0", async () => {
    if (!evolveSliders) {
      const mod = await import("../../src/services/feedback/sliderEvolution.js");
      evolveSliders = mod.evolveSliders;
    }

    const sliders = new Map([
      ["rock", 0.02],
      ["pop", 0.0],
    ]);
    const trackGenreVector = makeGenreVector({ rock: 0.5, pop: 0.3 });

    // dislike = -0.15
    // rock: 0.02 + 0.5*(-0.15) = 0.02 - 0.075 = -0.055 → clamped to 0
    // pop: 0.0 + 0.3*(-0.15) = -0.045 → clamped to 0
    const result = evolveSliders({
      currentSliders: sliders,
      locked: [],
      trackGenreVector,
      action: "dislike",
    });

    assert.strictEqual(result.sliders.get("rock"), 0);
    assert.strictEqual(result.sliders.get("pop"), 0);
  });

  it("REQ-002: should skip locked genres during evolution", async () => {
    if (!evolveSliders) {
      const mod = await import("../../src/services/feedback/sliderEvolution.js");
      evolveSliders = mod.evolveSliders;
    }

    const sliders = new Map([
      ["rock", 1.0],
      ["jazz", 0.8],
      ["pop", 0.5],
    ]);
    const trackGenreVector = makeGenreVector({ rock: 0.6, jazz: 0.4, pop: 0.3 });

    const result = evolveSliders({
      currentSliders: sliders,
      locked: ["jazz"],
      trackGenreVector,
      action: "like",
    });

    // jazz is locked → moet exact 0.8 blijven
    assert.strictEqual(result.sliders.get("jazz"), 0.8);
    // rock is NOT locked → moet geëvolueerd zijn (1.0 + 0.6*0.1 = 1.06)
    assert.strictEqual(Math.round(result.sliders.get("rock") * 100) / 100, 1.06);
    // jazz mag NIET in changed staan
    assert.strictEqual(result.changed.jazz, undefined);
    // locked array in result
    assert.deepStrictEqual(result.locked, ["jazz"]);
  });

  it("REQ-004: should return changed deltas for modified genres", async () => {
    if (!evolveSliders) {
      const mod = await import("../../src/services/feedback/sliderEvolution.js");
      evolveSliders = mod.evolveSliders;
    }

    const sliders = new Map([
      ["rock", 1.0],
      ["pop", 0.5],
      ["jazz", 0.8],
    ]);
    const trackGenreVector = makeGenreVector({ rock: 0.8, pop: 0.2 });

    const result = evolveSliders({
      currentSliders: sliders,
      locked: [],
      trackGenreVector,
      action: "like",
    });

    // changed bevat alleen genres met delta !== 0
    assert.ok("rock" in result.changed, "rock should be in changed");
    assert.ok("pop" in result.changed, "pop should be in changed");
    assert.strictEqual(result.changed.jazz, undefined, "jazz delta is 0, should not be in changed");
    // Deltas kloppen: rock = 0.8*0.1 = 0.08, pop = 0.2*0.1 = 0.02
    assert.strictEqual(result.changed.rock, 0.08);
    assert.strictEqual(result.changed.pop, 0.02);
    // locked array in result
    assert.deepStrictEqual(result.locked, []);
  });
});
