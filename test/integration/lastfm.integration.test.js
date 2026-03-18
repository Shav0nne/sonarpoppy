import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createLastfmClient } from "../../src/services/lastfm/client.js";

const API_KEY = process.env.LASTFM_API_KEY;

describe("Last.fm integration", { skip: !API_KEY && "LASTFM_API_KEY not set" }, () => {
  let client;

  before(() => {
    client = createLastfmClient({ apiKey: API_KEY });
  });

  it("getTrackInfo returns valid data for a known track", async () => {
    const result = await client.getTrackInfo("Radiohead", "Creep");

    assert.equal(typeof result.title, "string");
    assert.ok(result.title.length > 0);
    assert.equal(typeof result.artist, "string");
    assert.equal(typeof result.lastfmUrl, "string");
    assert.ok(result.lastfmUrl.startsWith("https://"));
  });

  it("getTrackTopTags returns tags with count", async () => {
    const result = await client.getTrackTopTags("Radiohead", "Creep");

    assert.ok(Array.isArray(result));
    if (result.length > 0) {
      assert.equal(typeof result[0].name, "string");
      assert.equal(typeof result[0].count, "number");
      // Verify sorted descending
      for (let i = 1; i < result.length; i++) {
        assert.ok(result[i].count <= result[i - 1].count);
      }
    }
  });

  it("getArtistTopTags returns tags with count", async () => {
    const result = await client.getArtistTopTags("Radiohead");

    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0, "Known artist should have tags");
    assert.equal(typeof result[0].name, "string");
    assert.equal(typeof result[0].count, "number");
  });
});
