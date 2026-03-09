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

const credentials = { clientId: "test_id", clientSecret: "test_secret", rateLimit: false };

// --- Test 1: Auth 401 bij runtime (REQ-001) ---

test("REQ-001: Auth 401 bij runtime — token fetch faalt met SpotifyApiError", async (t) => {
  const originalFetch = global.fetch;
  t.afterEach(() => {
    global.fetch = originalFetch;
  });

  await t.test(
    "should throw SpotifyApiError with status 401 when token endpoint rejects",
    async () => {
      global.fetch = mockFetchSequence([
        () => ({ ok: false, status: 401, text: async () => "Unauthorized" }),
      ]);

      const client = createSpotifyClient(credentials);

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
      assert.strictEqual(global.fetch.calls.length, 1);
      assert.ok(global.fetch.calls[0].url.includes("token"));
    },
  );
});

// --- Test 2: Token refresh bij expiry < 60s buffer (REQ-001) ---

test("REQ-001: Token proactief refreshed wanneer remaining lifetime < 60s", async (t) => {
  const originalFetch = global.fetch;
  t.afterEach(() => {
    global.fetch = originalFetch;
  });

  await t.test("should re-fetch token when expires_in is within 60s window", async () => {
    // First token expires in 59 seconds — immediately within the 60s buffer
    global.fetch = mockFetchSequence([
      tokenOk(59), // first token: expires in 59s (< 60s buffer)
      () => searchOk(), // first search
      tokenOk(3600), // re-fetched token: expires in 1h
      () => searchOk(), // second search
    ]);

    const client = createSpotifyClient(credentials);

    await client.searchTrack("A1", "T1");
    await client.searchTrack("A2", "T2");

    // Token endpoint should be called TWICE (refresh triggered on second call)
    const tokenCalls = global.fetch.calls.filter((c) => c.url.includes("token"));
    assert.strictEqual(tokenCalls.length, 2, "Token should be fetched twice due to 60s buffer");
  });
});

// --- Test 6: getAudioFeatures 403 → silent fallback {} (REQ-006) ---

test("REQ-006: getAudioFeatures retourneert {} bij 403 Forbidden", async (t) => {
  const originalFetch = global.fetch;
  t.afterEach(() => {
    global.fetch = originalFetch;
  });

  await t.test("should return empty object when audio features endpoint returns 403", async () => {
    global.fetch = mockFetchSequence([
      tokenOk(),
      () => ({
        ok: false,
        status: 403,
        text: async () => "Forbidden - Audio Features not available",
      }),
    ]);

    const client = createSpotifyClient(credentials);
    const result = await client.getAudioFeatures("some_id");

    assert.deepStrictEqual(result, {}, "Should return empty object for 403");
  });

  await t.test("should return empty object when audio features endpoint returns 404", async () => {
    global.fetch = mockFetchSequence([
      tokenOk(),
      () => ({ ok: false, status: 404, text: async () => "Not Found" }),
    ]);

    const client = createSpotifyClient(credentials);
    const result = await client.getAudioFeatures("nonexistent_id");

    assert.deepStrictEqual(result, {}, "Should return empty object for 404");
  });

  await t.test("should throw for non-403/404 errors in audio features", async () => {
    global.fetch = mockFetchSequence([
      tokenOk(),
      () => ({ ok: false, status: 500, text: async () => "Internal Server Error" }),
    ]);

    const client = createSpotifyClient(credentials);

    await assert.rejects(
      () => client.getAudioFeatures("some_id"),
      (err) => {
        assert.ok(err instanceof SpotifyApiError);
        assert.strictEqual(err.status, 500);
        return true;
      },
    );
  });
});

// --- Test 8: enrichTracks response format (REQ-005) ---

test("REQ-005: enrichTracks response bevat verwachte velden", async (t) => {
  // Dynamic import to get the module for mocking Track
  const { enrichTracks } = await import("../../src/services/spotify/enrichSpotify.js");
  const Track = (await import("../../src/models/Track.js")).default;

  t.beforeEach(() => {
    Track.find = mock.fn(async () => [{ _id: "id1", artist: "A1", title: "T1" }]);
    Track.findByIdAndUpdate = mock.fn(async () => {});
  });

  t.afterEach(() => {
    mock.restoreAll();
  });

  await t.test(
    "response should have total, processed, matched, errors, matches fields",
    async () => {
      const mockClient = {
        searchTrack: mock.fn(async () => ({ spotifyId: "sp1", spotifyUri: "spotify:track:sp1" })),
        getAudioFeatures: mock.fn(async () => ({ danceability: 0.8 })),
      };

      const result = await enrichTracks(mockClient);

      // Verify all expected fields exist
      assert.ok("total" in result, "should have total");
      assert.ok("processed" in result, "should have processed");
      assert.ok("matched" in result, "should have matched");
      assert.ok("errors" in result, "should have errors");
      assert.ok("matches" in result, "should have matches");

      // Verify types
      assert.strictEqual(typeof result.total, "number");
      assert.strictEqual(typeof result.processed, "number");
      assert.strictEqual(typeof result.matched, "number");
      assert.strictEqual(typeof result.errors, "number");
      assert.ok(Array.isArray(result.matches));

      // Verify match entry shape
      assert.strictEqual(result.matches.length, 1);
      assert.ok("id" in result.matches[0]);
      assert.ok("artist" in result.matches[0]);
      assert.ok("title" in result.matches[0]);
      assert.ok("spotifyId" in result.matches[0]);
    },
  );
});
