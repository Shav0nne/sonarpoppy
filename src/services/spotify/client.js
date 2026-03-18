import { createTokenBucket } from "../lastfm/rateLimiter.js";
import { mapSpotifyTrack } from "./mappers.js";
import { SpotifyApiError, SpotifyRateLimitError, SpotifyNotFoundError } from "./errors.js";

const SPOTIFY_API_URL = "https://api.spotify.com/v1";
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/api/token";

function isRetryable(err) {
  if (err instanceof SpotifyNotFoundError) return false;
  if (err instanceof SpotifyRateLimitError) return true;
  if (err instanceof SpotifyApiError && err.status >= 500) return true;
  if (err.name === "TypeError") return true; // network errors
  return false;
}

export function createSpotifyClient({
  clientId,
  clientSecret,
  fetch: fetchFn = globalThis.fetch,
  maxRetries = 3,
  baseDelay = 500,
  rateLimit = true,
}) {
  if (!clientId || !clientSecret) {
    throw new Error("clientId and clientSecret are required");
  }

  let accessToken = null;
  let tokenExpiresAt = 0;

  // 10 requests / second for Spotify
  const bucket = rateLimit ? createTokenBucket({ capacity: 10, refillRate: 10 }) : null;

  async function getAccessToken() {
    // Refresh token proactively 60 seconds before expiration
    if (accessToken && Date.now() < tokenExpiresAt - 60000) {
      return accessToken;
    }

    const response = await fetchFn(SPOTIFY_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new SpotifyApiError(`Failed to fetch access token: ${text}`, response.status);
    }

    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiresAt = Date.now() + data.expires_in * 1000;

    return accessToken;
  }

  async function fetchWithAuth(url, options = {}) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delay =
          lastError instanceof SpotifyRateLimitError
            ? lastError.retryAfter * 1000
            : baseDelay * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }

      try {
        if (bucket) await bucket.acquire();

        const token = await getAccessToken();

        const response = await fetchFn(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 429) {
          const retryAfter = Number(response.headers.get("Retry-After")) || 5;
          throw new SpotifyRateLimitError(retryAfter);
        }

        if (!response.ok) {
          const text = await response.text();
          throw new SpotifyApiError(`Spotify API error: ${text}`, response.status);
        }

        return response.json();
      } catch (err) {
        lastError = err;
        if (!isRetryable(err) || attempt === maxRetries) {
          throw err;
        }
      }
    }

    throw lastError;
  }

  async function searchTrack(artist, title) {
    const query = `track:${title} artist:${artist}`;
    const searchUrl = new URL(`${SPOTIFY_API_URL}/search`);
    searchUrl.searchParams.append("q", query);
    searchUrl.searchParams.append("type", "track");
    searchUrl.searchParams.append("limit", "1");

    const data = await fetchWithAuth(searchUrl.toString());

    const item = data?.tracks?.items?.[0];
    if (!item) {
      return null;
    }

    return mapSpotifyTrack(item);
  }

  return { searchTrack };
}
