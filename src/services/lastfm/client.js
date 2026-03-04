import { createTokenBucket } from "./rateLimiter.js";
import { mapTrackInfo, mapTopTags } from "./mappers.js";
import { LastfmApiError, LastfmRateLimitError, LastfmNotFoundError } from "./errors.js";

const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

const LASTFM_ERROR_NOT_FOUND = 6;

function isRetryable(err) {
  if (err instanceof LastfmNotFoundError) return false;
  if (err instanceof LastfmRateLimitError) return true;
  if (err instanceof LastfmApiError && err.statusCode >= 500) return true;
  if (err.name === "TypeError") return true; // network errors
  return false;
}

export function createLastfmClient({
  apiKey,
  fetch: fetchFn = globalThis.fetch,
  maxRetries = 3,
  baseDelay = 200,
  rateLimit = true,
} = {}) {
  if (!apiKey) throw new Error("apiKey is required");

  const bucket = rateLimit ? createTokenBucket({ capacity: 5, refillRate: 5 }) : null;

  async function request(params) {
    const url = new URL(BASE_URL);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("format", "json");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = baseDelay * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }

      try {
        if (bucket) await bucket.acquire();

        const response = await fetchFn(url.toString());

        if (response.status === 429) {
          throw new LastfmRateLimitError();
        }

        if (!response.ok) {
          throw new LastfmApiError(`HTTP ${response.status}`, response.status);
        }

        const data = await response.json();

        if (data.error) {
          if (data.error === LASTFM_ERROR_NOT_FOUND) {
            throw new LastfmNotFoundError(data.message);
          }
          throw new LastfmApiError(data.message || "Unknown Last.fm error");
        }

        return data;
      } catch (err) {
        lastError = err;
        if (!isRetryable(err) || attempt === maxRetries) {
          throw err;
        }
      }
    }

    throw lastError;
  }

  async function getTrackInfo(artist, title) {
    const data = await request({
      method: "track.getInfo",
      artist,
      track: title,
    });
    return mapTrackInfo(data);
  }

  async function getTrackTopTags(artist, title) {
    const data = await request({
      method: "track.getTopTags",
      artist,
      track: title,
    });
    return mapTopTags(data);
  }

  async function getArtistTopTags(artist) {
    const data = await request({
      method: "artist.getTopTags",
      artist,
    });
    return mapTopTags(data);
  }

  return { getTrackInfo, getTrackTopTags, getArtistTopTags };
}
