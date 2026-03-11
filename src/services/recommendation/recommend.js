import Track from "../../models/Track.js";
import Feedback from "../../models/Feedback.js";
import { cosineSimilarity } from "../../utils/similarity.js";
import { hybridScore, DEFAULT_WEIGHTS } from "../scoring/hybridScore.js";
import { getFeedbackMultiplier } from "../feedback/feedbackMultiplier.js";
import { getDialPreset } from "../../config/dial.js";
import { computeCfScore } from "../cf/cfScore.js";
import { getBlacklistFilters, isGenreBlocked } from "../blacklist/blacklistFilter.js";

function hasValidGenreVector(track) {
  return Array.isArray(track.genreVector) && track.genreVector.length > 0;
}

export function scoreTracks(
  profileVector,
  tracks,
  weights,
  feedbackMap = null,
  cfContext = null,
  blockedGenres = [],
  overrides = {},
) {
  const scored = [];

  for (const track of tracks) {
    if (!hasValidGenreVector(track)) continue;

    if (isGenreBlocked(track.genreVector, blockedGenres)) {
      continue;
    }

    const genreScore = cosineSimilarity(profileVector, track.genreVector);

    const cfScore = cfContext
      ? computeCfScore(track, cfContext.likedTrackKeys, cfContext.likedArtists, overrides.cfConfig)
      : null;

    const signals = { genre: genreScore, cf: cfScore };

    const trackId = String(track._id);
    const feedback = feedbackMap?.get(trackId) ?? null;
    const multiplier = getFeedbackMultiplier(feedback, overrides.feedbackConfig);

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

/**
 * Apply bubble filter based on dial preset configuration.
 * Filters scored tracks by genre similarity threshold and unplayed status.
 */
function applyBubbleFilter(scored, preset, feedbackMap) {
  let filtered = scored;

  // Genre similarity filter
  if (preset.filter.type === "minGenreSim" && preset.filter.threshold != null) {
    filtered = filtered.filter((s) => s.signals.genre >= preset.filter.threshold);
  }

  // Unplayed-only filter (Stand 4)
  if (preset.unplayedOnly && feedbackMap) {
    filtered = filtered.filter((s) => {
      const fb = feedbackMap.get(String(s.track._id));
      if (!fb) return true; // No feedback record → unplayed
      return fb.playCount === 0;
    });
  } else if (preset.unplayedOnly) {
    // No feedbackMap → all tracks are "unplayed"
  }

  return filtered;
}

/**
 * Sort tracks by the dial preset's sort signal.
 */
function sortBySignal(scored, preset) {
  if (preset.sortSignal === "genreSim") {
    return [...scored].sort((a, b) => b.signals.genre - a.signals.genre);
  }

  if (preset.sortSignal === "cf") {
    return [...scored].sort((a, b) => {
      const aCf = a.signals.cf;
      const bCf = b.signals.cf;
      // Both have CF → sort by CF desc
      if (aCf != null && bCf != null) return bCf - aCf;
      // One has CF, other doesn't → CF-having track first
      if (aCf != null) return -1;
      if (bCf != null) return 1;
      // Both null CF → fallback to genreSim desc
      return b.signals.genre - a.signals.genre;
    });
  }

  if (preset.sortSignal === "random") {
    const shuffled = [...scored];
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  return scored;
}

export async function getRecommendations({
  profileVector,
  limit,
  offset = 0,
  filters = {},
  dial,
  userId,
  overrides = {},
  _tracks,
  _feedbackMap,
}) {
  // Resolve dial preset; default = Stand 3
  let preset;
  let dialPosition;
  if (dial != null) {
    preset = getDialPreset(dial);
    dialPosition = preset.position;
  } else {
    preset = getDialPreset(3);
    dialPosition = 3;
  }

  // Scoring altijd met 50/50 gewichten — dial is een post-score filter
  const w = DEFAULT_WEIGHTS;

  // Build feedback map per track voor deze user
  let feedbackMap = _feedbackMap ?? null;
  if (!feedbackMap && userId) {
    const feedbackDocs = await Feedback.find({ userId }).lean();
    feedbackMap = new Map(feedbackDocs.map((fb) => [String(fb.trackId), fb]));
  }

  // Get blacklist filters
  const { blockedTracks, blockedArtists, blockedGenres } = await getBlacklistFilters(userId);

  // Build the MongoDB pre-score query
  const query = {};
  if (blockedTracks.length > 0) {
    query._id = { $nin: blockedTracks };
  }
  if (blockedArtists.length > 0) {
    query.artist = { $nin: blockedArtists };
  }

  const candidates = _tracks ?? (await Track.find(query).lean());

  // Build CF context from liked tracks for CF scoring
  let cfContext = null;
  if (feedbackMap) {
    const likedTrackKeys = new Set();
    const likedArtists = new Set();
    for (const track of candidates) {
      const fb = feedbackMap.get(String(track._id));
      if (fb && (fb.action === "like" || fb.action === "library")) {
        likedTrackKeys.add(`${track.artist.toLowerCase()}|${track.title.toLowerCase()}`);
        likedArtists.add(track.artist.toLowerCase());
      }
    }
    if (likedTrackKeys.size > 0) {
      cfContext = { likedTrackKeys, likedArtists };
    }
  }

  let scored = scoreTracks(
    profileVector,
    candidates,
    w,
    feedbackMap,
    cfContext,
    blockedGenres,
    overrides,
  );

  // Apply bubble filter (post-score)
  scored = applyBubbleFilter(scored, preset, feedbackMap);

  // Sort by dial signal
  scored = sortBySignal(scored, preset);

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
    activeSignals,
    dialPosition,
  };

  return { tracks: paged, total, meta };
}
