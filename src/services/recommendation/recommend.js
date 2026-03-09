import Track from "../../models/Track.js";
import Feedback from "../../models/Feedback.js";
import { cosineSimilarity } from "../../utils/similarity.js";
import { hybridScore, DEFAULT_WEIGHTS } from "../scoring/hybridScore.js";
import { getFeedbackMultiplier } from "../feedback/feedbackMultiplier.js";
import { getDialPreset } from "../../config/dial.js";

function hasValidGenreVector(track) {
  return Array.isArray(track.genreVector) && track.genreVector.length > 0;
}

export function scoreTracks(profileVector, tracks, weights, feedbackMap = null) {
  const scored = [];

  for (const track of tracks) {
    if (!hasValidGenreVector(track)) continue;

    const genreScore = cosineSimilarity(profileVector, track.genreVector);

    // cf is null until that feature is built
    const signals = { genre: genreScore, cf: null };

    const trackId = String(track._id);
    const feedback = feedbackMap?.get(trackId) ?? null;
    const multiplier = getFeedbackMultiplier(feedback);

    const result = hybridScore(signals, weights, multiplier);

    scored.push({
      track,
      finalScore: result.finalScore,
      signals: result.signals,
      appliedWeights: result.appliedWeights,
      feedbackMultiplier: result.feedbackMultiplier,
    });
  }

  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored;
}

export async function getRecommendations({
  profileVector,
  limit,
  offset = 0,
  filters = {},
  weights,
  dial,
  userId,
  _tracks,
}) {
  // dial overschrijft weights; geen dial + geen weights → default Stand 3
  let w;
  let dialPosition;
  if (dial != null) {
    const preset = getDialPreset(dial);
    w = preset.weights;
    dialPosition = preset.position;
  } else if (weights != null) {
    w = weights;
    dialPosition = null;
  } else {
    w = DEFAULT_WEIGHTS;
    dialPosition = 3;
  }

  // Build feedback map per track voor deze user
  let feedbackMap = null;
  if (userId) {
    const feedbackDocs = await Feedback.find({ userId }).lean();
    feedbackMap = new Map(feedbackDocs.map((fb) => [String(fb.trackId), fb]));
  }

  const candidates = _tracks ?? (await Track.find().lean());
  let scored = scoreTracks(profileVector, candidates, w, feedbackMap);

  if (filters.minScore != null) {
    scored = scored.filter((s) => s.finalScore >= filters.minScore);
  }
  if (filters.excludeIds?.length) {
    const excluded = new Set(filters.excludeIds.map(String));
    scored = scored.filter((s) => !excluded.has(String(s.track._id)));
  }

  const total = scored.length;
  const paged = limit != null ? scored.slice(offset, offset + limit) : scored.slice(offset);

  const scores = scored.map((s) => s.finalScore);
  const activeSignals =
    scored.length > 0
      ? [
          ...new Set(
            scored.flatMap((s) => Object.keys(s.signals).filter((k) => s.signals[k] != null)),
          ),
        ]
      : [];

  const meta = {
    scoredAt: new Date().toISOString(),
    avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    scoreRange: {
      min: scores.length > 0 ? Math.min(...scores) : 0,
      max: scores.length > 0 ? Math.max(...scores) : 0,
    },
    configuredWeights: w,
    activeSignals,
    dialPosition,
  };

  return { tracks: paged, total, meta };
}
