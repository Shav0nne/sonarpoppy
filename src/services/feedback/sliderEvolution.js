import { GENRES, GENRE_INDEX } from "../../config/genres.js";
import { evolveProfileWeights } from "./profileEvolution.js";

/**
 * Orchestreert slider evolutie: converteert GenreSliders (name-based Map)
 * naar index-based weights, roept evolveProfileWeights aan, clampt op 0,
 * en retourneert geüpdatete sliders + delta's.
 *
 * @param {Object} opts
 * @param {Map<string,number>} opts.currentSliders — genre name → weight
 * @param {string[]} opts.locked — genre names die niet aangepast worden
 * @param {number[]} opts.trackGenreVector — 20-dim vector van de track
 * @param {string} opts.action — like/dislike/library/skip
 * @returns {{ sliders: Map<string,number>, changed: Object, locked: string[] }}
 */
export function evolveSliders({ currentSliders, locked, trackGenreVector, action }) {
  // Converteer name-based sliders → index-based weights voor evolveProfileWeights
  const indexWeights = {};
  for (const [name, weight] of currentSliders) {
    const idx = GENRE_INDEX[name];
    if (idx !== undefined) indexWeights[String(idx)] = weight;
  }

  // Locked genres: naam → index
  const lockedIndices =
    locked?.map((name) => GENRE_INDEX[name]).filter((idx) => idx !== undefined) ?? [];

  // evolveProfileWeights verwacht feedbackItems[] en tracks[]
  const feedbackItems = [{ action, trackId: "t" }];
  const tracks = [{ _id: "t", genreVector: trackGenreVector }];

  const evolved = evolveProfileWeights(indexWeights, feedbackItems, tracks, lockedIndices);

  // Converteer terug naar name-based Map + clamp op 0 + bereken delta's
  const newSliders = new Map();
  const changed = {};
  const lockedSet = new Set(locked ?? []);

  for (const genre of GENRES) {
    const idx = GENRE_INDEX[genre];
    const oldVal = currentSliders.get(genre) ?? 0;
    const rawVal = evolved[String(idx)] ?? oldVal;
    const clampedVal = Math.max(0, rawVal);

    newSliders.set(genre, clampedVal);

    if (!lockedSet.has(genre)) {
      const delta = +(clampedVal - oldVal).toFixed(4);
      if (delta !== 0) changed[genre] = delta;
    }
  }

  return {
    sliders: newSliders,
    changed,
    locked: locked ?? [],
  };
}
