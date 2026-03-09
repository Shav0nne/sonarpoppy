import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DIAL_PRESETS, getDialPreset } from "../../src/config/dial.js";

// REQ-001: 5 dial presets als frozen config
describe("DIAL_PRESETS — structure", () => {
  it("bevat exact 5 presets", () => {
    assert.equal(DIAL_PRESETS.length, 5);
  });

  it("elke preset heeft position, name, description, weights", () => {
    for (const preset of DIAL_PRESETS) {
      assert.equal(typeof preset.position, "number");
      assert.equal(typeof preset.name, "string");
      assert.equal(typeof preset.description, "string");
      assert.ok(preset.weights);
      assert.equal(typeof preset.weights.genre, "number");
      assert.equal(typeof preset.weights.cf, "number");
    }
  });

  it("positions zijn 1 t/m 5", () => {
    const positions = DIAL_PRESETS.map((p) => p.position);
    assert.deepEqual(positions, [1, 2, 3, 4, 5]);
  });

  it("gewichten sommeren tot 1.0 per preset", () => {
    for (const preset of DIAL_PRESETS) {
      const sum = preset.weights.genre + preset.weights.cf;
      assert.ok(
        Math.abs(sum - 1.0) < 0.001,
        `Stand ${preset.position}: weights sum ${sum} !== 1.0`,
      );
    }
  });

  it("is frozen (onwijzigbaar)", () => {
    assert.ok(Object.isFrozen(DIAL_PRESETS));
  });

  it("individuele presets zijn frozen", () => {
    for (const preset of DIAL_PRESETS) {
      assert.ok(Object.isFrozen(preset), `Stand ${preset.position} is niet frozen`);
    }
  });
});

// REQ-001: Specifieke gewichten per stand
describe("DIAL_PRESETS — gewichten per stand", () => {
  it("Stand 1 (Strikt): genre-zwaar", () => {
    const s = DIAL_PRESETS[0];
    assert.deepEqual(s.weights, { genre: 0.7, cf: 0.3 });
  });

  it("Stand 2 (Dichtbij): herkenbaar met variatie", () => {
    const s = DIAL_PRESETS[1];
    assert.deepEqual(s.weights, { genre: 0.6, cf: 0.4 });
  });

  it("Stand 3 (Gebalanceerd): gelijke mix", () => {
    const s = DIAL_PRESETS[2];
    assert.deepEqual(s.weights, { genre: 0.5, cf: 0.5 });
  });

  it("Stand 4 (Ontdekking): CF-zwaar", () => {
    const s = DIAL_PRESETS[3];
    assert.deepEqual(s.weights, { genre: 0.4, cf: 0.6 });
  });

  it("Stand 5 (Anti-bubbel): maximaal buiten bubbel", () => {
    const s = DIAL_PRESETS[4];
    assert.deepEqual(s.weights, { genre: 0.3, cf: 0.7 });
  });

  it("genre daalt monotoon van Stand 1→5", () => {
    for (let i = 0; i < 4; i++) {
      assert.ok(
        DIAL_PRESETS[i].weights.genre > DIAL_PRESETS[i + 1].weights.genre,
        `genre Stand ${i + 1} moet > Stand ${i + 2}`,
      );
    }
  });

  it("cf stijgt monotoon van Stand 1→5", () => {
    for (let i = 0; i < 4; i++) {
      assert.ok(
        DIAL_PRESETS[i].weights.cf < DIAL_PRESETS[i + 1].weights.cf,
        `cf Stand ${i + 1} moet < Stand ${i + 2}`,
      );
    }
  });
});

// REQ-002: getDialPreset() resolver
describe("getDialPreset — geldige input", () => {
  it("retourneert preset voor position 1", () => {
    const result = getDialPreset(1);
    assert.equal(result.position, 1);
    assert.equal(result.name, "Strikt");
  });

  it("retourneert preset voor position 5", () => {
    const result = getDialPreset(5);
    assert.equal(result.position, 5);
    assert.equal(result.name, "Anti-bubbel");
  });

  it("retourneert preset voor elke geldige position", () => {
    for (let i = 1; i <= 5; i++) {
      const result = getDialPreset(i);
      assert.equal(result.position, i);
    }
  });
});

describe("getDialPreset — ongeldige input", () => {
  it("gooit error bij position 0", () => {
    assert.throws(() => getDialPreset(0));
  });

  it("gooit error bij position 6", () => {
    assert.throws(() => getDialPreset(6));
  });

  it("gooit error bij decimaal (2.5)", () => {
    assert.throws(() => getDialPreset(2.5));
  });

  it("gooit error bij null", () => {
    assert.throws(() => getDialPreset(null));
  });

  it("gooit error bij undefined", () => {
    assert.throws(() => getDialPreset(undefined));
  });

  it("gooit error bij string", () => {
    assert.throws(() => getDialPreset("3"));
  });

  it("gooit error bij negatief getal", () => {
    assert.throws(() => getDialPreset(-1));
  });
});
