import { createTokenBucket } from "../lastfm/rateLimiter.js";
import { mapSpotifyTrack, mapAudioFeatures } from "./mappers.js";
import {
    SpotifyApiError,
    SpotifyRateLimitError,
    SpotifyNotFoundError,
} from "./errors.js";

const SPOTIFY_API_URL = "https://api.spotify.com/v1";
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/api/token";

export function createSpotifyClient({ clientId, clientSecret, rateLimit = true }) {
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

        const response = await fetch(SPOTIFY_AUTH_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${Buffer.from(
                    `${clientId}:${clientSecret}`
                ).toString("base64")}`,
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
        if (bucket) await bucket.acquire();

        const token = await getAccessToken();

        const response = await fetch(url, {
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

    async function getAudioFeatures(spotifyId) {
        try {
            const data = await fetchWithAuth(`${SPOTIFY_API_URL}/audio-features/${spotifyId}`);
            return mapAudioFeatures(data);
        } catch (error) {
            // If audio features are not found or forbidden (Spotify Web API new quota limits),
            // we don't want to break the whole enrichment flow
            if (error instanceof SpotifyApiError && (error.status === 404 || error.status === 403)) {
                return mapAudioFeatures(null); // return empty object
            }
            throw error;
        }
    }

    return {
        searchTrack,
        getAudioFeatures,
    };
}
