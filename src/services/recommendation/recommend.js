import Track from "../../models/Track.js";
import Feedback from "../../models/Feedback.js";
import { cosineSimilarity } from "../../utils/similarity.js";
import { hybridScore, DEFAULT_WEIGHTS } from "../scoring/hybridScore.js";
import { getFeedbackMultiplier } from "../feedback/feedbackMultiplier.js";
import { getDialPreset } from "../../config/dial.js";
import { computeCfScore } from "../cf/cfScore.js";
import { getBlacklistFilters, isGenreBlocked } from "../blacklist/blacklistFilter.js";
import { GENRES } from "../../config/genres.js";
import mongoose from "mongoose";
import { getAlgorithmConfig, DEFAULT_ALGORITHM_CONFIG } from "../admin/configLoader.js";

/**
 * Get dominant genre name for a track's genreVector.
 * Returns the genre name with the highest value.
 */
function getDominantGenre(genreVector) {
  let maxIdx = 0;
  let maxVal = genreVector[0];
  for (let i = 1; i < genreVector.length; i++) {
    if (genreVector[i] > maxVal) {
      maxVal = genreVector[i];
      maxIdx = i;
    }
  }
  return GENRES[maxIdx];
}

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
    return [...scored].sort((a, b) => b.finalScore - a.finalScore);
  }

  if (preset.sortSignal === "cf") {
    return [...scored].sort((a, b) => {
      const aCf = a.signals.cf;
      const bCf = b.signals.cf;
      // Both have CF → sort by finalScore (incorporates CF + feedback)
      if (aCf != null && bCf != null) return b.finalScore - a.finalScore;
      // One has CF, other doesn't → CF-having track first
      if (aCf != null) return -1;
      if (bCf != null) return 1;
      // Both null CF → fallback to finalScore
      return b.finalScore - a.finalScore;
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

/**
 * Sort tracks by frontend sort-override parameter.
 * Replaces dial sortSignal but bubble filter stays active.
 */
function sortByOverride(scored, sortKey) {
  if (sortKey === "genreSim") {
    return [...scored].sort((a, b) => b.signals.genre - a.signals.genre);
  }

  if (sortKey === "cf") {
    return [...scored].sort((a, b) => {
      const aCf = a.signals.cf;
      const bCf = b.signals.cf;
      if (aCf != null && bCf != null) return bCf - aCf;
      if (aCf != null) return -1;
      if (bCf != null) return 1;
      return b.finalScore - a.finalScore;
    });
  }

  if (sortKey === "random") {
    const shuffled = [...scored];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  if (sortKey === "recent") {
    return [...scored].sort((a, b) => {
      const aDate = a.track.createdAt ? new Date(a.track.createdAt) : new Date(0);
      const bDate = b.track.createdAt ? new Date(b.track.createdAt) : new Date(0);
      return bDate - aDate;
    });
  }

  return scored;
}

/**
 * Apply all post-score filters in one consolidated step.
 */
function applyFilters(scored, filters = {}, feedbackMap = null, now = null) {
  let result = scored;

  // Genre filter — match dominant genre
  if (filters.genre != null) {
    const target = filters.genre.toLowerCase();
    result = result.filter((s) => getDominantGenre(s.track.genreVector) === target);
  }

  // Artist filter — case-insensitive exact match
  if (filters.artist != null) {
    const target = filters.artist.toLowerCase();
    result = result.filter((s) => s.track.artist.toLowerCase() === target);
  }

  // Explicit filter — tri-state: true=only explicit, false=no explicit, null=no filter
  if (filters.explicit === true) {
    result = result.filter((s) => s.track.explicit === true);
  } else if (filters.explicit === false) {
    result = result.filter((s) => s.track.explicit !== true);
  }

  // Unplayed filter — only tracks without feedback/plays
  if (filters.unplayed === true && feedbackMap) {
    result = result.filter((s) => {
      const fb = feedbackMap.get(String(s.track._id));
      if (!fb) return true;
      return fb.playCount === 0;
    });
  }

  // Recent filter — tracks created within N days
  if (filters.recentDays != null) {
    const ref = now || new Date();
    const cutoff = new Date(ref.getTime() - filters.recentDays * 24 * 60 * 60 * 1000);
    result = result.filter((s) => {
      if (!s.track.createdAt) return false;
      return new Date(s.track.createdAt) >= cutoff;
    });
  }

  // minScore filter
  if (filters.minScore != null) {
    result = result.filter((s) => s.finalScore >= filters.minScore);
  }

  // excludeIds filter
  if (filters.excludeIds?.length) {
    const excluded = new Set(filters.excludeIds.map(String));
    result = result.filter((s) => !excluded.has(String(s.track._id)));
  }

  return result;
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
  _algorithmConfig,
}) {
  // Load algorithm config from DB, injected override, or defaults
  let configObj;
  if (_algorithmConfig) {
    configObj = _algorithmConfig.toObject ? _algorithmConfig.toObject() : _algorithmConfig;
  } else if (mongoose.connection.readyState === 1) {
    const doc = await getAlgorithmConfig();
    configObj = doc.toObject ? doc.toObject() : doc;
  } else {
    configObj = DEFAULT_ALGORITHM_CONFIG;
  }

  // Resolve dial preset with config overrides; default = Stand 3
  let preset;
  let dialPosition;
  const dialOverrides = configObj.dialPresets?.length ? configObj.dialPresets : null;
  if (dial != null) {
    preset = getDialPreset(dial, dialOverrides);
    dialPosition = preset.position;
  } else {
    preset = getDialPreset(3, dialOverrides);
    dialPosition = 3;
  }

  // Use hybrid weights from config
  const w = configObj.hybridWeights ?? DEFAULT_WEIGHTS;

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

  // Build config-enriched overrides for scoring functions
  const scoringOverrides = {
    ...overrides,
    feedbackConfig: overrides.feedbackConfig ?? {
      ...configObj.feedbackMultipliers,
      playThreshold: configObj.playCount?.threshold,
      playBonus: configObj.playCount?.bonus,
      halfLifeDays: configObj.playCount?.halfLifeDays,
    },
    cfConfig: overrides.cfConfig ?? {
      trackWeight: configObj.cfWeights?.track,
      artistWeight: configObj.cfWeights?.artist,
    },
  };

  let scored = scoreTracks(
    profileVector,
    candidates,
    w,
    feedbackMap,
    cfContext,
    blockedGenres,
    scoringOverrides,
  );

  // Apply bubble filter (post-score)
  scored = applyBubbleFilter(scored, preset, feedbackMap);

  // Sort: override or dial signal
  if (filters.sort != null) {
    scored = sortByOverride(scored, filters.sort);
  } else {
    scored = sortBySignal(scored, preset);
  }

  scored = applyFilters(scored, filters, feedbackMap, overrides._now);

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
