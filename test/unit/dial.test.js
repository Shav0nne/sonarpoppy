import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DIAL_PRESETS, getDialPreset } from "../../src/config/dial.js";

// REQ-001: 5 dial presets als frozen config met filter+sort structuur
describe("DIAL_PRESETS — structure", () => {
  it("bevat exact 5 presets", () => {
    assert.equal(DIAL_PRESETS.length, 5);
  });

  it("elke preset heeft position, name, description, filter, sortSignal, unplayedOnly", () => {
    for (const preset of DIAL_PRESETS) {
      assert.equal(typeof preset.position, "number");
      assert.equal(typeof preset.name, "string");
      assert.equal(typeof preset.description, "string");
      assert.ok(preset.filter, `Stand ${preset.position}: filter ontbreekt`);
      assert.equal(typeof preset.filter.type, "string");
      assert.equal(typeof preset.sortSignal, "string");
      assert.equal(typeof preset.unplayedOnly, "boolean");
    }
  });

  it("positions zijn 1 t/m 5", () => {
    const positions = DIAL_PRESETS.map((p) => p.position);
    assert.deepEqual(positions, [1, 2, 3, 4, 5]);
  });

  it("filter.type is altijd minGenreSim, maxGenreSim, of none", () => {
    const validTypes = ["minGenreSim", "maxGenreSim", "none"];
    for (const preset of DIAL_PRESETS) {
      assert.ok(
        validTypes.includes(preset.filter.type),
        `Stand ${preset.position}: ongeldige filter type "${preset.filter.type}"`,
      );
    }
  });

  it("sortSignal is altijd genreSim, cf, of random", () => {
    const validSignals = ["genreSim", "cf", "random"];
    for (const preset of DIAL_PRESETS) {
      assert.ok(
        validSignals.includes(preset.sortSignal),
        `Stand ${preset.position}: ongeldige sortSignal "${preset.sortSignal}"`,
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

// REQ-001: Specifieke config per stand
describe("DIAL_PRESETS — config per stand", () => {
  it("Stand 1 (Strikt): minGenreSim 0.6, sort genreSim", () => {
    const s = DIAL_PRESETS[0];
    assert.deepEqual(s.filter, { type: "minGenreSim", threshold: 0.6 });
    assert.equal(s.sortSignal, "genreSim");
    assert.equal(s.unplayedOnly, false);
  });

  it("Stand 2 (Dichtbij): minGenreSim 0.3, sort genreSim", () => {
    const s = DIAL_PRESETS[1];
    assert.deepEqual(s.filter, { type: "minGenreSim", threshold: 0.3 });
    assert.equal(s.sortSignal, "genreSim");
    assert.equal(s.unplayedOnly, false);
  });

  it("Stand 3 (Gebalanceerd): geen filter, sort genreSim", () => {
    const s = DIAL_PRESETS[2];
    assert.deepEqual(s.filter, { type: "none", threshold: null });
    assert.equal(s.sortSignal, "genreSim");
    assert.equal(s.unplayedOnly, false);
  });

  it("Stand 4 (Ontdekking): geen filter, sort CF, unplayedOnly", () => {
    const s = DIAL_PRESETS[3];
    assert.deepEqual(s.filter, { type: "none", threshold: null });
    assert.equal(s.sortSignal, "cf");
    assert.equal(s.unplayedOnly, true);
  });

  it("Stand 5 (Anti-bubbel): geen filter, sort random", () => {
    const s = DIAL_PRESETS[4];
    assert.deepEqual(s.filter, { type: "none", threshold: null });
    assert.equal(s.sortSignal, "random");
    assert.equal(s.unplayedOnly, false);
  });

  it("drempels dalen monotoon van Stand 1→3 (steeds minder streng)", () => {
    const thresholds = DIAL_PRESETS.slice(0, 3).map((p) => p.filter.threshold ?? 0);
    for (let i = 0; i < thresholds.length - 1; i++) {
      assert.ok(
        thresholds[i] >= thresholds[i + 1],
        `threshold Stand ${i + 1} (${thresholds[i]}) moet >= Stand ${i + 2} (${thresholds[i + 1]})`,
      );
    }
  });
});

// REQ-001: getDialPreset() resolver
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
