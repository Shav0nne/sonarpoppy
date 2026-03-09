import test from "node:test";
import assert from "node:assert";
import { createSpotifyClient } from "../../src/services/spotify/client.js";
import { SpotifyApiError, SpotifyRateLimitError } from "../../src/services/spotify/errors.js";

function createMockFetch(overrides = {}) {
    let calls = [];
    const mockFetch = async (url, options) => {
        calls.push({ url: url.toString(), options });

        if (overrides[url.toString()]) {
            return overrides[url.toString()]();
        }

        if (url.toString().includes("token")) {
            if (overrides.onToken) return overrides.onToken();
            return { ok: true, json: async () => ({ access_token: "mock_token", expires_in: 3600 }) };
        }

        if (url.toString().includes("search")) {
            if (overrides.onSearch) return overrides.onSearch(url.toString());
            return {
                ok: true,
                json: async () => ({
                    tracks: { items: [{ id: "123", uri: "spotify:track:123", duration_ms: 1000, explicit: false, album: { images: [] } }] },
                }),
            };
        }

        if (url.toString().includes("audio-features/123")) {
            if (overrides.onFeatures) return overrides.onFeatures();
            return { ok: true, json: async () => ({ danceability: 0.8, energy: 0.9 }) };
        }

        console.error("Unhandled mock fetch URL:", url);
        return { ok: false, status: 404, text: async () => "Not found" };
    };
    mockFetch.calls = calls;
    return mockFetch;
}

test("Spotify client", async (t) => {
    const credentials = {
        clientId: "test_client",
        clientSecret: "test_secret",
        rateLimit: false,
    };

    const originalFetch = global.fetch;
    t.afterEach(() => {
        global.fetch = originalFetch;
    });

    await t.test("should throw if credentials are missing", () => {
        assert.throws(() => createSpotifyClient({ clientId: "test" }), /required/);
    });

    await t.test("should obtain token and search track", async () => {
        global.fetch = createMockFetch();
        const client = createSpotifyClient(credentials);

        const result = await client.searchTrack("Test Artist", "Test Title");

        assert.strictEqual(result.spotifyId, "123");
        assert.strictEqual(global.fetch.calls.length, 2);

        const searchCall = global.fetch.calls.find(c => c.url.includes("search"));
        assert.ok(searchCall.url.includes("Test+Title"));
    });

    await t.test("should reuse valid token for subsequent calls", async () => {
        global.fetch = createMockFetch();
        const client = createSpotifyClient(credentials);

        await client.searchTrack("A1", "T1");
        await client.searchTrack("A2", "T2");

        assert.strictEqual(global.fetch.calls.length, 3);
    });

    await t.test("should handle missing track from search gracefully", async () => {
        global.fetch = createMockFetch({
            onSearch: () => ({ ok: true, json: async () => ({ tracks: { items: [] } }) })
        });
        const client = createSpotifyClient(credentials);

        const result = await client.searchTrack("A1", "T1");
        assert.strictEqual(result, null);
    });

    await t.test("should fetch and map audio features", async () => {
        global.fetch = createMockFetch();
        const client = createSpotifyClient(credentials);
        const result = await client.getAudioFeatures("123");
        assert.strictEqual(result.danceability, 0.8);
        assert.strictEqual(result.energy, 0.9);
    });

    await t.test("should throw SpotifyRateLimitError on 429", async () => {
        global.fetch = createMockFetch({
            onSearch: () => {
                const headers = new Headers();
                headers.set("Retry-After", "10");
                return { ok: false, status: 429, headers, text: async () => "" };
            }
        });

        const client = createSpotifyClient(credentials);

        await assert.rejects(
            () => client.searchTrack("A", "T"),
            (err) => err instanceof SpotifyRateLimitError && err.retryAfter === 10
        );
    });
});
