import { GENRE_COUNT, resolveAlias, genreNameToIndex } from "../config/genres.js";

/**
 * Normaliseert een genre-vector zodat waarden optellen tot 1.0.
 * Zero-vector input → zero-vector output (geen division by zero).
 */
export function normalizeVector(vector) {
  const sum = vector.reduce((a, b) => a + b, 0);
  if (sum === 0) return vector.slice();
  return vector.map((v) => v / sum);
}

/**
 * Zet een array van Last.fm tags om naar een genre-vector (20 floats).
 * Tags worden via resolveAlias gemapped naar standaard genres.
 * Elke tag telt als 1 punt voor zijn genre. Resultaat wordt genormaliseerd.
 * Lege/null/ongeldige input → zero-vector.
 */
export function createVector(tags) {
  const vector = new Array(GENRE_COUNT).fill(0);

  if (!Array.isArray(tags) || tags.length === 0) return vector;

  for (const tag of tags) {
    if (tag == null || typeof tag !== "string") continue;

    const genre = resolveAlias(tag);
    if (genre == null) continue;

    const idx = genreNameToIndex(genre);
    if (idx != null) {
      vector[idx] += 1;
    }
  }

  return normalizeVector(vector);
}
