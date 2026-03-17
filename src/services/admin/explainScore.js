import Track from "../../models/Track.js";
import Feedback from "../../models/Feedback.js";
import { cosineSimilarity } from "../../utils/similarity.js";
import { hybridScore } from "../scoring/hybridScore.js";
import { getFeedbackMultiplier } from "../feedback/feedbackMultiplier.js";
import { computeCfScore } from "../cf/cfScore.js";
import { getDialPreset } from "../../config/dial.js";
import { getAlgorithmConfig } from "./configLoader.js";

export async function explainTrackScore(trackId, userId) {
  const config = await getAlgorithmConfig();
  const configObj = config.toObject ? config.toObject() : config;

  const track = await Track.findById(trackId).lean();
  if (!track) return null;

  // Get user feedback for this track
  const feedback = await Feedback.findOne({ userId, trackId }).lean();

  // Build CF context from all user liked tracks
  const allFeedback = await Feedback.find({ userId }).lean();
  const likedTrackKeys = new Set();
  const likedArtists = new Set();

  if (allFeedback.length > 0) {
    const likedFeedback = allFeedback.filter(
      (fb) => fb.action === "like" || fb.action === "library",
    );
    if (likedFeedback.length > 0) {
      const likedTrackIds = likedFeedback.map((fb) => fb.trackId);
      const likedTracks = await Track.find({ _id: { $in: likedTrackIds } }).lean();
      for (const lt of likedTracks) {
        likedTrackKeys.add(`${lt.artist.toLowerCase()}|${lt.title.toLowerCase()}`);
        likedArtists.add(lt.artist.toLowerCase());
      }
    }
  }

  // Compute genre score (needs user profile vector — use equal weights as baseline)
  // In production this would use the user's actual profile vector
  const { computeProfileVector } = await import("../profile/computeProfile.js");
  const GenreSliders = (await import("../../models/GenreSliders.js")).default;
  const sliders = await GenreSliders.findOne({ userId }).lean();
  const slidersData = sliders?.sliders;
  const weights =
    slidersData instanceof Map
      ? Object.fromEntries(slidersData)
      : slidersData && typeof slidersData === "object"
        ? slidersData
        : {};
  const { vector: profileVector } = computeProfileVector(weights);

  const genreScore = cosineSimilarity(profileVector, track.genreVector);

  // CF score
  const cfConfig = {
    trackWeight: configObj.cfWeights?.track,
    artistWeight: configObj.cfWeights?.artist,
  };
  const cfScore =
    likedTrackKeys.size > 0 ? computeCfScore(track, likedTrackKeys, likedArtists, cfConfig) : null;

  // Feedback multiplier
  const feedbackConfig = {
    ...configObj.feedbackMultipliers,
    playThreshold: configObj.playCount?.threshold,
    playBonus: configObj.playCount?.bonus,
    halfLifeDays: configObj.playCount?.halfLifeDays,
  };
  const feedbackMultiplier = getFeedbackMultiplier(feedback, feedbackConfig);

  // Hybrid score
  const signals = { genre: genreScore, cf: cfScore };
  const hybridWeights = configObj.hybridWeights;
  const result = hybridScore(signals, hybridWeights, feedbackMultiplier);

  // Bubble filter status (default dial = 3)
  const dialOverrides = configObj.dialPresets?.length ? configObj.dialPresets : null;
  const preset = getDialPreset(3, dialOverrides);
  const passes =
    preset.filter.type === "none" ||
    preset.filter.threshold == null ||
    genreScore >= preset.filter.threshold;

  return {
    track: { _id: track._id, artist: track.artist, title: track.title },
    genreScore,
    cfScore,
    hybridWeights,
    rawScore: result.finalScore / feedbackMultiplier || 0,
    feedbackMultiplier,
    feedbackAction: feedback?.action ?? null,
    finalScore: result.finalScore,
    bubbleFilter: {
      dial: preset.position,
      threshold: preset.filter.threshold,
      passes,
    },
    cfDetail: {
      trackOverlap: track.similarTracks?.length ?? 0,
      artistOverlap: track.similarArtists?.length ?? 0,
      enrichedAt: track.cfEnrichedAt ?? null,
    },
  };
}
