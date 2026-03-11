import { GENRES, resolveAlias } from "../../config/genres.js";
import GenreSliders from "../../models/GenreSliders.js";
import User from "../../models/User.js";
import { computeProfileVector } from "../profile/computeProfile.js";

const VALID_APPS = ["sonarpop", "poppy"];
const GENRE_SET = new Set(GENRES);

export function validateOnboarding({ userId, genres, artists, app }) {
  if (!userId) throw new Error("userId is required");
  if (!VALID_APPS.includes(app)) throw new Error("app must be sonarpop or poppy");

  const invalidGenres = (genres || []).filter((g) => !GENRE_SET.has(g));
  if (invalidGenres.length > 0) {
    throw new Error(`Invalid genre(s): ${invalidGenres.join(", ")}`);
  }

  if (!genres || genres.length < 3) {
    throw new Error("At least 3 genres required");
  }

  if (app === "sonarpop" && (!artists || artists.length < 3)) {
    throw new Error("At least 3 artists required for SonarPop");
  }
}

const BASE_WEIGHT = 0.1;

export function calculateGenreWeights(selectedGenres) {
  const selected = new Set(selectedGenres);
  const weights = {};
  for (const genre of GENRES) {
    weights[genre] = selected.has(genre) ? 1.0 : BASE_WEIGHT;
  }
  return weights;
}

const ARTIST_BOOST = 0.3;

export async function applyArtistBoost(weights, artists, lastfmClient) {
  if (!artists || artists.length === 0) return { ...weights };

  const boosted = { ...weights };
  const genreHits = {};

  for (const artist of artists) {
    let tags;
    try {
      tags = await lastfmClient.getArtistTopTags(artist);
    } catch {
      continue;
    }

    for (const tag of tags) {
      const genre = resolveAlias(tag.name);
      if (!genre) continue;
      genreHits[genre] = (genreHits[genre] || 0) + tag.count / 100;
    }
  }

  for (const [genre, score] of Object.entries(genreHits)) {
    const normalizedScore = Math.min(score / artists.length, 1);
    boosted[genre] = Math.min(1.0, boosted[genre] + ARTIST_BOOST * normalizedScore);
  }

  return boosted;
}

export async function processOnboarding({ userId, genres, artists, app, lastfmClient }) {
  validateOnboarding({ userId, genres, artists, app });

  let weights = calculateGenreWeights(genres);

  if (artists && artists.length > 0) {
    weights = await applyArtistBoost(weights, artists, lastfmClient);
  }

  // Upsert GenreSliders — overschrijft bij herhaalde onboarding
  await GenreSliders.findOneAndUpdate(
    { userId },
    { sliders: weights, locked: [] },
    { upsert: true, new: true },
  );

  // Update User to reflect onboarding completion
  await User.findByIdAndUpdate(userId, { hasCompletedOnboarding: true });

  const profile = computeProfileVector(weights);

  return { profile, sliders: weights };
}
