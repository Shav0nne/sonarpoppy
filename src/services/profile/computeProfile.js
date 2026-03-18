import { GENRES, GENRE_COUNT, GENRE_INDEX } from "../../config/genres.js";
import { normalizeVector } from "../../utils/genreVector.js";

export function computeProfileVector(weights) {
  const vector = new Array(GENRE_COUNT).fill(0);

  if (weights && typeof weights === "object") {
    for (const [genre, weight] of Object.entries(weights)) {
      const idx = GENRE_INDEX[genre];
      if (idx === undefined) continue;
      vector[idx] = Math.max(0, weight);
    }
  }

  const sum = vector.reduce((a, b) => a + b, 0);
  const normalized =
    sum === 0 ? new Array(GENRE_COUNT).fill(1 / GENRE_COUNT) : normalizeVector(vector);

  const isColdStart = sum === 0;
  const activeGenres = normalized.filter((v) => v > 0).length;

  let topGenre = null;
  if (!isColdStart) {
    let maxVal = 0;
    let maxIdx = -1;
    for (let i = 0; i < normalized.length; i++) {
      if (normalized[i] > maxVal) {
        maxVal = normalized[i];
        maxIdx = i;
      }
    }
    if (maxIdx >= 0) topGenre = GENRES[maxIdx];
  }

  return { vector: normalized, meta: { activeGenres, topGenre } };
}
