import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDialPreset, DIAL_PRESETS } from "../../src/config/dial.js";

// REQ-005: getDialPreset accept config overrides en merged met frozen defaults
describe("getDialPreset — config overrides", () => {
  it("retourneert frozen default zonder overrides", () => {
    const preset = getDialPreset(1);
    assert.equal(preset.position, 1);
    assert.equal(preset.filter.threshold, 0.6);
    assert.equal(preset.sortSignal, "genreSim");
    assert.equal(preset.unplayedOnly, false);
  });

  it("overschrijft threshold via config overrides", () => {
    const overrides = [
      { position: 1, threshold: 0.8, sortSignal: "genreSim", unplayedOnly: false },
    ];
    const preset = getDialPreset(1, overrides);
    assert.equal(preset.filter.threshold, 0.8);
    assert.equal(preset.sortSignal, "genreSim");
  });

  it("overschrijft sortSignal via config overrides", () => {
    const overrides = [{ position: 3, threshold: null, sortSignal: "cf", unplayedOnly: false }];
    const preset = getDialPreset(3, overrides);
    assert.equal(preset.sortSignal, "cf");
    assert.equal(preset.filter.threshold, null); // original default
  });

  it("overschrijft unplayedOnly via config overrides", () => {
    const overrides = [
      { position: 3, threshold: null, sortSignal: "genreSim", unplayedOnly: true },
    ];
    const preset = getDialPreset(3, overrides);
    assert.equal(preset.unplayedOnly, true);
  });

  it("retourneert frozen default als positie niet in overrides zit", () => {
    const overrides = [
      { position: 1, threshold: 0.8, sortSignal: "genreSim", unplayedOnly: false },
    ];
    const preset = getDialPreset(2, overrides);
    assert.equal(preset.filter.threshold, 0.3); // original stand 2 default
    assert.equal(preset.sortSignal, "genreSim");
  });

  it("lege overrides array retourneert frozen default", () => {
    const preset = getDialPreset(1, []);
    assert.equal(preset.filter.threshold, 0.6);
  });

  it("null overrides retourneert frozen default", () => {
    const preset = getDialPreset(1, null);
    assert.equal(preset.filter.threshold, 0.6);
  });

  it("5 frozen standen blijven intact", () => {
    assert.equal(DIAL_PRESETS.length, 5);
    assert.ok(Object.isFrozen(DIAL_PRESETS));
  });
});
