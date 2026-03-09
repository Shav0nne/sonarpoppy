const DIAL_PRESETS = Object.freeze([
  Object.freeze({
    position: 1,
    name: "Strikt",
    description: "Genre-zwaar, voorspelbaar. Blijft dicht bij je smaak.",
    weights: Object.freeze({ genre: 0.5, cf: 0.2, audio: 0.3 }),
  }),
  Object.freeze({
    position: 2,
    name: "Dichtbij",
    description: "Herkenbaar met lichte variatie.",
    weights: Object.freeze({ genre: 0.4, cf: 0.3, audio: 0.3 }),
  }),
  Object.freeze({
    position: 3,
    name: "Gebalanceerd",
    description: "Gelijke mix van alle signalen.",
    weights: Object.freeze({ genre: 0.3, cf: 0.4, audio: 0.3 }),
  }),
  Object.freeze({
    position: 4,
    name: "Ontdekking",
    description: "CF-zwaar, cross-genre verrassingen.",
    weights: Object.freeze({ genre: 0.2, cf: 0.5, audio: 0.3 }),
  }),
  Object.freeze({
    position: 5,
    name: "Anti-bubbel",
    description: "Maximaal buiten de bubbel.",
    weights: Object.freeze({ genre: 0.1, cf: 0.6, audio: 0.3 }),
  }),
]);

function getDialPreset(position) {
  if (typeof position !== "number" || !Number.isInteger(position) || position < 1 || position > 5) {
    throw new RangeError(`Invalid dial position: ${position}. Must be integer 1-5.`);
  }
  return DIAL_PRESETS[position - 1];
}

export { DIAL_PRESETS, getDialPreset };
