import Track from "../../models/Track.js";
import { cosineSimilarity } from "../../utils/similarity.js";

function hasValidGenreVector(track) {
  return Array.isArray(track.genreVector) && track.genreVector.length > 0;
}

export function scoreTracks(profileVector, tracks) {
  const scored = [];

  for (const track of tracks) {
    if (!hasValidGenreVector(track)) continue;
    const score = cosineSimilarity(profileVector, track.genreVector);
    scored.push({ track, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

export async function getRecommendations({
  profileVector,
  limit,
  offset = 0,
  filters = {},
  _tracks,
}) {
  const candidates = _tracks ?? (await Track.find().lean());
  let scored = scoreTracks(profileVector, candidates);

  if (filters.minScore != null) {
    scored = scored.filter((s) => s.score >= filters.minScore);
  }
  if (filters.excludeIds?.length) {
    const excluded = new Set(filters.excludeIds.map(String));
    scored = scored.filter((s) => !excluded.has(String(s.track._id)));
  }

  const total = scored.length;
  const paged = limit != null ? scored.slice(offset, offset + limit) : scored.slice(offset);

  const scores = scored.map((s) => s.score);
  const meta = {
    scoredAt: new Date().toISOString(),
    avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    scoreRange: {
      min: scores.length > 0 ? Math.min(...scores) : 0,
      max: scores.length > 0 ? Math.max(...scores) : 0,
    },
  };

  return { tracks: paged, total, meta };
}
