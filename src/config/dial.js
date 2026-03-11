const DIAL_PRESETS = Object.freeze([
  Object.freeze({
    position: 1,
    name: "Strikt",
    description: "Blijft dicht bij je smaak. Alleen tracks met hoge genre-match.",
    filter: Object.freeze({ type: "minGenreSim", threshold: 0.6 }),
    sortSignal: "genreSim",
    unplayedOnly: false,
  }),
  Object.freeze({
    position: 2,
    name: "Dichtbij",
    description: "Herkenbaar met lichte variatie. Filtert op redelijke genre-match.",
    filter: Object.freeze({ type: "minGenreSim", threshold: 0.3 }),
    sortSignal: "genreSim",
    unplayedOnly: false,
  }),
  Object.freeze({
    position: 3,
    name: "Gebalanceerd",
    description: "Alles komt erdoor. Gesorteerd op genre-match.",
    filter: Object.freeze({ type: "none", threshold: null }),
    sortSignal: "genreSim",
    unplayedOnly: false,
  }),
  Object.freeze({
    position: 4,
    name: "Ontdekking",
    description: "Alleen onbeluisterde tracks. Gesorteerd op CF-score.",
    filter: Object.freeze({ type: "none", threshold: null }),
    sortSignal: "cf",
    unplayedOnly: true,
  }),
  Object.freeze({
    position: 5,
    name: "Anti-bubbel",
    description: "Pure random. Maximaal buiten de bubbel.",
    filter: Object.freeze({ type: "none", threshold: null }),
    sortSignal: "random",
    unplayedOnly: false,
  }),
]);

function getDialPreset(position) {
  if (typeof position !== "number" || !Number.isInteger(position) || position < 1 || position > 5) {
    throw new RangeError(`Invalid dial position: ${position}. Must be integer 1-5.`);
  }
  return DIAL_PRESETS[position - 1];
}

export { DIAL_PRESETS, getDialPreset };
