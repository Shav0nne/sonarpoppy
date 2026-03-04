import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createLastfmClient } from "../../src/services/lastfm/client.js";
import {
  LastfmApiError,
  LastfmRateLimitError,
  LastfmNotFoundError,
} from "../../src/services/lastfm/errors.js";

const BASE_URL = "https://ws.audioscrobbler.com/2.0/";
const API_KEY = "test-api-key-123";

function mockFetch(responses) {
  let callIndex = 0;
  const calls = [];

  const fn = async (url) => {
    calls.push(url);
    const response = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;

    if (response.error) {
      throw response.error;
    }

    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.json,
    };
  };

  return { fn, calls };
}

describe("createLastfmClient", () => {
  it("requires apiKey", () => {
    assert.throws(() => createLastfmClient({}), {
      message: /apiKey/i,
    });
  });

  it("returns client with expected methods", () => {
    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: async () => {},
    });
    assert.equal(typeof client.getTrackInfo, "function");
    assert.equal(typeof client.getTrackTopTags, "function");
    assert.equal(typeof client.getArtistTopTags, "function");
  });
});

describe("API key in requests", () => {
  it("includes api_key and format=json in all requests", async () => {
    const { fn, calls } = mockFetch([
      {
        json: {
          track: {
            name: "Test",
            artist: { name: "Artist" },
            duration: "0",
            url: "https://last.fm",
            mbid: "",
          },
        },
      },
    ]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
    });
    await client.getTrackInfo("Artist", "Test");

    assert.equal(calls.length, 1);
    const url = new URL(calls[0]);
    assert.equal(url.searchParams.get("api_key"), API_KEY);
    assert.equal(url.searchParams.get("format"), "json");
  });
});

describe("getTrackInfo", () => {
  it("calls track.getInfo and returns mapped result", async () => {
    const { fn } = mockFetch([
      {
        json: {
          track: {
            name: "Bohemian Rhapsody",
            artist: { name: "Queen" },
            album: { title: "A Night at the Opera" },
            duration: "354000",
            toptags: { tag: [{ name: "rock" }] },
            url: "https://last.fm/queen/bohemian",
            mbid: "abc-123",
            image: [{ "#text": "https://img.fm/large.jpg", size: "large" }],
          },
        },
      },
    ]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
    });
    const result = await client.getTrackInfo("Queen", "Bohemian Rhapsody");

    assert.equal(result.title, "Bohemian Rhapsody");
    assert.equal(result.artist, "Queen");
    assert.equal(result.duration, 354);
  });

  it("uses correct API method and params", async () => {
    const { fn, calls } = mockFetch([
      {
        json: {
          track: {
            name: "Test",
            artist: { name: "Art" },
            duration: "0",
            url: "u",
            mbid: "",
          },
        },
      },
    ]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
    });
    await client.getTrackInfo("Art", "Test");

    const url = new URL(calls[0]);
    assert.equal(url.searchParams.get("method"), "track.getInfo");
    assert.equal(url.searchParams.get("artist"), "Art");
    assert.equal(url.searchParams.get("track"), "Test");
  });
});

describe("getTrackTopTags", () => {
  it("calls track.getTopTags and returns sorted tags", async () => {
    const { fn } = mockFetch([
      {
        json: {
          toptags: {
            tag: [
              { name: "rock", count: 100 },
              { name: "pop", count: 50 },
            ],
          },
        },
      },
    ]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
    });
    const result = await client.getTrackTopTags("Queen", "Bohemian Rhapsody");

    assert.equal(result.length, 2);
    assert.equal(result[0].name, "rock");
    assert.equal(result[0].count, 100);
  });
});

describe("getArtistTopTags", () => {
  it("calls artist.getTopTags and returns sorted tags", async () => {
    const { fn } = mockFetch([
      {
        json: {
          toptags: {
            tag: [
              { name: "rock", count: 100 },
              { name: "classic rock", count: 80 },
            ],
          },
        },
      },
    ]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
    });
    const result = await client.getArtistTopTags("Queen");

    assert.equal(result.length, 2);
    assert.equal(result[0].name, "rock");
  });

  it("uses correct API method and params", async () => {
    const { fn, calls } = mockFetch([{ json: { toptags: { tag: [] } } }]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
    });
    await client.getArtistTopTags("Queen");

    const url = new URL(calls[0]);
    assert.equal(url.searchParams.get("method"), "artist.getTopTags");
    assert.equal(url.searchParams.get("artist"), "Queen");
  });
});

describe("error handling", () => {
  it("throws LastfmNotFoundError on Last.fm error 6 (not found)", async () => {
    const { fn } = mockFetch([{ json: { error: 6, message: "Track not found" } }]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
      maxRetries: 0,
    });

    await assert.rejects(
      () => client.getTrackInfo("X", "Y"),
      (err) => {
        assert.ok(err instanceof LastfmNotFoundError);
        return true;
      },
    );
  });

  it("throws LastfmRateLimitError on HTTP 429", async () => {
    const { fn } = mockFetch([{ ok: false, status: 429, json: {} }]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
      maxRetries: 0,
    });

    await assert.rejects(
      () => client.getTrackInfo("X", "Y"),
      (err) => {
        assert.ok(err instanceof LastfmRateLimitError);
        return true;
      },
    );
  });

  it("throws LastfmApiError on other HTTP errors", async () => {
    const { fn } = mockFetch([{ ok: false, status: 500, json: {} }]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
      maxRetries: 0,
    });

    await assert.rejects(
      () => client.getTrackInfo("X", "Y"),
      (err) => {
        assert.ok(err instanceof LastfmApiError);
        assert.equal(err.statusCode, 500);
        return true;
      },
    );
  });
});

describe("retry with exponential backoff", () => {
  it("retries on 429 and succeeds", async () => {
    const { fn, calls } = mockFetch([
      { ok: false, status: 429, json: {} },
      {
        json: {
          track: {
            name: "T",
            artist: { name: "A" },
            duration: "0",
            url: "u",
            mbid: "",
          },
        },
      },
    ]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
      maxRetries: 3,
      baseDelay: 10,
    });

    const result = await client.getTrackInfo("A", "T");
    assert.equal(calls.length, 2);
    assert.equal(result.title, "T");
  });

  it("retries on 5xx errors", async () => {
    const { fn, calls } = mockFetch([
      { ok: false, status: 503, json: {} },
      {
        json: {
          track: {
            name: "T",
            artist: { name: "A" },
            duration: "0",
            url: "u",
            mbid: "",
          },
        },
      },
    ]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
      maxRetries: 3,
      baseDelay: 10,
    });

    const result = await client.getTrackInfo("A", "T");
    assert.equal(calls.length, 2);
  });

  it("retries on network errors", async () => {
    const { fn, calls } = mockFetch([
      { error: new TypeError("fetch failed") },
      {
        json: {
          track: {
            name: "T",
            artist: { name: "A" },
            duration: "0",
            url: "u",
            mbid: "",
          },
        },
      },
    ]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
      maxRetries: 3,
      baseDelay: 10,
    });

    const result = await client.getTrackInfo("A", "T");
    assert.equal(calls.length, 2);
  });

  it("gives up after max retries", async () => {
    const { fn, calls } = mockFetch([
      { ok: false, status: 500, json: {} },
      { ok: false, status: 500, json: {} },
      { ok: false, status: 500, json: {} },
      { ok: false, status: 500, json: {} },
    ]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
      maxRetries: 3,
      baseDelay: 10,
    });

    await assert.rejects(() => client.getTrackInfo("A", "T"));
    assert.equal(calls.length, 4); // 1 initial + 3 retries
  });

  it("does not retry on 4xx (except 429)", async () => {
    const { fn, calls } = mockFetch([{ ok: false, status: 400, json: {} }]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
      maxRetries: 3,
      baseDelay: 10,
    });

    await assert.rejects(() => client.getTrackInfo("A", "T"));
    assert.equal(calls.length, 1);
  });

  it("does not retry on Last.fm not found errors", async () => {
    const { fn, calls } = mockFetch([{ json: { error: 6, message: "Not found" } }]);

    const client = createLastfmClient({
      apiKey: API_KEY,
      fetch: fn,
      rateLimit: false,
      maxRetries: 3,
      baseDelay: 10,
    });

    await assert.rejects(() => client.getTrackInfo("A", "T"));
    assert.equal(calls.length, 1);
  });
});
