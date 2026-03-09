import test, { mock } from "node:test";
import assert from "node:assert";
import { createSpotifyClient } from "../../src/services/spotify/client.js";
import { SpotifyApiError, SpotifyRateLimitError } from "../../src/services/spotify/errors.js";

// --- Helpers ---

function mockFetchSequence(responses) {
  let callIndex = 0;
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url: url.toString(), options });
    const idx = Math.min(callIndex++, responses.length - 1);
    return responses[idx]();
  };
  fn.calls = calls;
  return fn;
}

const tokenOk =
  (expiresIn = 3600) =>
  () => ({
    ok: true,
    json: async () => ({ access_token: "tok_" + Date.now(), expires_in: expiresIn }),
  });

const searchOk = () => ({
  ok: true,
  json: async () => ({
    tracks: {
      items: [
        {
          id: "sp1",
          uri: "spotify:track:sp1",
          duration_ms: 200000,
          explicit: false,
          album: { images: [{ url: "img", height: 300, width: 300 }] },
        },
      ],
    },
  }),
});

const credentials = {
  clientId: "test_id",
  clientSecret: "test_secret",
  rateLimit: false,
  maxRetries: 0,
};

// --- Test 1: Auth 401 bij runtime (REQ-001) ---

test("REQ-001: Auth 401 bij runtime — token fetch faalt met SpotifyApiError", async (t) => {
  await t.test(
    "should throw SpotifyApiError with status 401 when token endpoint rejects",
    async () => {
      const mockFetch = mockFetchSequence([
        () => ({ ok: false, status: 401, text: async () => "Unauthorized" }),
      ]);

      const client = createSpotifyClient({ ...credentials, fetch: mockFetch });

      await assert.rejects(
        () => client.searchTrack("Artist", "Title"),
        (err) => {
          assert.ok(err instanceof SpotifyApiError, "should be SpotifyApiError");
          assert.strictEqual(err.status, 401);
          assert.ok(err.message.includes("Failed to fetch access token"));
          return true;
        },
      );

      // Verify no search call was made
      assert.strictEqual(mockFetch.calls.length, 1);
      assert.ok(mockFetch.calls[0].url.includes("token"));
    },
  );
});

// --- Test 2: Token refresh bij expiry < 60s buffer (REQ-001) ---

test("REQ-001: Token proactief refreshed wanneer remaining lifetime < 60s", async (t) => {
  await t.test("should re-fetch token when expires_in is within 60s window", async () => {
    // First token expires in 59 seconds — immediately within the 60s buffer
    const mockFetch = mockFetchSequence([
      tokenOk(59), // first token: expires in 59s (< 60s buffer)
      () => searchOk(), // first search
      tokenOk(3600), // re-fetched token: expires in 1h
      () => searchOk(), // second search
    ]);

    const client = createSpotifyClient({ ...credentials, fetch: mockFetch });

    await client.searchTrack("A1", "T1");
    await client.searchTrack("A2", "T2");

    // Token endpoint should be called TWICE (refresh triggered on second call)
    const tokenCalls = mockFetch.calls.filter((c) => c.url.includes("token"));
    assert.strictEqual(tokenCalls.length, 2, "Token should be fetched twice due to 60s buffer");
  });
});

// --- Test 3: enrichTracks response format (REQ-005) ---

test("REQ-005: enrichTracks response bevat verwachte velden", async (t) => {
  const { enrichTracks } = await import("../../src/services/spotify/enrichSpotify.js");
  const Track = (await import("../../src/models/Track.js")).default;

  t.beforeEach(() => {
    Track.find = () => ({
      limit: async () => [{ _id: "id1", artist: "A1", title: "T1" }],
    });
    Track.findByIdAndUpdate = mock.fn(async () => {});
  });

  t.afterEach(() => {
    mock.restoreAll();
  });

  await t.test("response should have total, enriched, skipped, failed, errors fields", async () => {
    const mockClient = {
      searchTrack: mock.fn(async () => ({ spotifyId: "sp1", spotifyUri: "spotify:track:sp1" })),
    };

    const result = await enrichTracks(mockClient);

    // Verify all expected fields exist
    assert.ok("total" in result, "should have total");
    assert.ok("enriched" in result, "should have enriched");
    assert.ok("skipped" in result, "should have skipped");
    assert.ok("failed" in result, "should have failed");
    assert.ok("errors" in result, "should have errors");

    // Verify types
    assert.strictEqual(typeof result.total, "number");
    assert.strictEqual(typeof result.enriched, "number");
    assert.strictEqual(typeof result.skipped, "number");
    assert.strictEqual(typeof result.failed, "number");
    assert.ok(Array.isArray(result.errors));

    // Verify counts
    assert.strictEqual(result.enriched, 1);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 0);
  });
});
