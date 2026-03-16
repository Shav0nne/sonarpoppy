import test from "node:test";
import assert from "node:assert";
import { createSpotifyClient } from "../../src/services/spotify/client.js";
import { SpotifyApiError, SpotifyRateLimitError } from "../../src/services/spotify/errors.js";

function createMockFetch(overrides = {}) {
  let calls = [];
  const mockFetch = async (url, options) => {
    calls.push({ url: url.toString(), options });

    if (url.toString().includes("token")) {
      if (overrides.onToken) return overrides.onToken();
      return { ok: true, json: async () => ({ access_token: "mock_token", expires_in: 3600 }) };
    }

    if (url.toString().includes("search")) {
      if (overrides.onSearch) return overrides.onSearch(url.toString());
      return {
        ok: true,
        json: async () => ({
          tracks: {
            items: [
              {
                id: "123",
                uri: "spotify:track:123",
                duration_ms: 1000,
                explicit: false,
                album: { images: [] },
              },
            ],
          },
        }),
      };
    }

    console.error("Unhandled mock fetch URL:", url);
    return { ok: false, status: 404, text: async () => "Not found" };
  };
  mockFetch.calls = calls;
  return mockFetch;
}

test("Spotify client", async (t) => {
  const baseOpts = { clientId: "test_client", clientSecret: "test_secret", rateLimit: false };

  await t.test("should throw if credentials are missing", () => {
    assert.throws(() => createSpotifyClient({ clientId: "test" }), /required/);
  });

  await t.test("should obtain token and search track", async () => {
    const mockFetch = createMockFetch();
    const client = createSpotifyClient({ ...baseOpts, fetch: mockFetch });

    const result = await client.searchTrack("Test Artist", "Test Title");

    assert.strictEqual(result.spotifyId, "123");
    assert.strictEqual(mockFetch.calls.length, 2);

    const searchCall = mockFetch.calls.find((c) => c.url.includes("search"));
    assert.ok(searchCall.url.includes("Test+Title"));
  });

  await t.test("should reuse valid token for subsequent calls", async () => {
    const mockFetch = createMockFetch();
    const client = createSpotifyClient({ ...baseOpts, fetch: mockFetch });

    await client.searchTrack("A1", "T1");
    await client.searchTrack("A2", "T2");

    assert.strictEqual(mockFetch.calls.length, 3);
  });

  await t.test("should handle missing track from search gracefully", async () => {
    const mockFetch = createMockFetch({
      onSearch: () => ({ ok: true, json: async () => ({ tracks: { items: [] } }) }),
    });
    const client = createSpotifyClient({ ...baseOpts, fetch: mockFetch });

    const result = await client.searchTrack("A1", "T1");
    assert.strictEqual(result, null);
  });

  await t.test("should throw SpotifyRateLimitError on 429 after retries exhausted", async () => {
    const mockFetch = createMockFetch({
      onSearch: () => {
        const headers = new Headers();
        headers.set("Retry-After", "10");
        return { ok: false, status: 429, headers, text: async () => "" };
      },
    });

    const client = createSpotifyClient({ ...baseOpts, fetch: mockFetch, maxRetries: 0 });

    await assert.rejects(
      () => client.searchTrack("A", "T"),
      (err) => err instanceof SpotifyRateLimitError && err.retryAfter === 10,
    );
  });

  await t.test("should retry on 429 and succeed on next attempt", async () => {
    let searchAttempt = 0;
    const mockFetch = createMockFetch({
      onSearch: () => {
        searchAttempt++;
        if (searchAttempt === 1) {
          const headers = new Headers();
          headers.set("Retry-After", "1");
          return { ok: false, status: 429, headers, text: async () => "" };
        }
        return {
          ok: true,
          json: async () => ({
            tracks: {
              items: [
                {
                  id: "123",
                  uri: "spotify:track:123",
                  duration_ms: 1000,
                  explicit: false,
                  album: { images: [] },
                },
              ],
            },
          }),
        };
      },
    });

    const client = createSpotifyClient({ ...baseOpts, fetch: mockFetch, baseDelay: 1 });

    const result = await client.searchTrack("A", "T");
    assert.strictEqual(result.spotifyId, "123");
    assert.strictEqual(searchAttempt, 2);
  });

  await t.test("should not retry on non-retryable errors", async () => {
    let searchAttempt = 0;
    const mockFetch = createMockFetch({
      onSearch: () => {
        searchAttempt++;
        return { ok: false, status: 400, text: async () => "Bad Request" };
      },
    });

    const client = createSpotifyClient({ ...baseOpts, fetch: mockFetch, baseDelay: 0 });

    await assert.rejects(
      () => client.searchTrack("A", "T"),
      (err) => err instanceof SpotifyApiError && err.status === 400,
    );
    assert.strictEqual(searchAttempt, 1, "Should not retry 400 errors");
  });
});
