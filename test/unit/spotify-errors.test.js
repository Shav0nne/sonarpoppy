import test from "node:test";
import assert from "node:assert";
import {
    SpotifyApiError,
    SpotifyRateLimitError,
    SpotifyNotFoundError,
} from "../../src/services/spotify/errors.js";

test("SpotifyApiError", async (t) => {
    await t.test("should have correct name, message, and status", () => {
        const err = new SpotifyApiError("Test message", 500);
        assert.strictEqual(err.name, "SpotifyApiError");
        assert.strictEqual(err.message, "Test message");
        assert.strictEqual(err.status, 500);
        assert.ok(err instanceof Error);
    });
});

test("SpotifyRateLimitError", async (t) => {
    await t.test("should inherit from SpotifyApiError and have retryAfter", () => {
        const err = new SpotifyRateLimitError(30);
        assert.strictEqual(err.name, "SpotifyRateLimitError");
        assert.strictEqual(err.message, "Spotify API rate limit exceeded");
        assert.strictEqual(err.status, 429);
        assert.strictEqual(err.retryAfter, 30);
        assert.ok(err instanceof SpotifyApiError);
    });
});

test("SpotifyNotFoundError", async (t) => {
    await t.test("should inherit from SpotifyApiError and default to 404", () => {
        const err = new SpotifyNotFoundError();
        assert.strictEqual(err.name, "SpotifyNotFoundError");
        assert.strictEqual(err.message, "Track not found on Spotify");
        assert.strictEqual(err.status, 404);
        assert.ok(err instanceof SpotifyApiError);
    });

    await t.test("should allow custom message", () => {
        const err = new SpotifyNotFoundError("Custom not found");
        assert.strictEqual(err.message, "Custom not found");
    });
});
