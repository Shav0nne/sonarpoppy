/**
 * Berekent cosine similarity tussen twee vectoren.
 * Retourneert score 0-1. Throws bij ongeldige input.
 */
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new TypeError("Vectors must be arrays");
  }

  if (a.length !== b.length) {
    throw new Error("Vectors must have equal length");
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    if (typeof a[i] !== "number" || typeof b[i] !== "number") {
      throw new TypeError("Vector values must be numbers");
    }
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) return 0;

  return dot / (magA * magB);
}
