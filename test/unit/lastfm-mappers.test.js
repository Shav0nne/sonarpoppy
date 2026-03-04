import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapTrackInfo, mapTopTags } from "../../src/services/lastfm/mappers.js";

describe("mapTrackInfo", () => {
  const fullResponse = {
    track: {
      name: "Bohemian Rhapsody",
      artist: { name: "Queen" },
      album: { title: "A Night at the Opera", "#text": "A Night at the Opera" },
      duration: "354000",
      toptags: {
        tag: [
          { name: "rock", url: "https://last.fm/tag/rock" },
          { name: "classic rock", url: "https://last.fm/tag/classic+rock" },
        ],
      },
      url: "https://www.last.fm/music/Queen/_/Bohemian+Rhapsody",
      mbid: "b1a9c0e9-d987-4042-ae91-78d6a1502b65",
      image: [
        { "#text": "https://img.fm/small.jpg", size: "small" },
        { "#text": "https://img.fm/large.jpg", size: "large" },
        { "#text": "https://img.fm/extralarge.jpg", size: "extralarge" },
      ],
    },
  };

  it("maps a full response correctly", () => {
    const result = mapTrackInfo(fullResponse);
    assert.equal(result.title, "Bohemian Rhapsody");
    assert.equal(result.artist, "Queen");
    assert.equal(result.album, "A Night at the Opera");
    assert.equal(result.duration, 354);
    assert.deepEqual(result.tags, ["rock", "classic rock"]);
    assert.equal(result.lastfmUrl, "https://www.last.fm/music/Queen/_/Bohemian+Rhapsody");
    assert.equal(result.mbid, "b1a9c0e9-d987-4042-ae91-78d6a1502b65");
    assert.equal(result.imageUrl, "https://img.fm/extralarge.jpg");
  });

  it("converts duration from ms string to seconds", () => {
    const result = mapTrackInfo(fullResponse);
    assert.equal(result.duration, 354);
  });

  it("handles missing album", () => {
    const response = {
      track: { ...fullResponse.track, album: undefined },
    };
    const result = mapTrackInfo(response);
    assert.equal(result.album, null);
  });

  it("handles duration of 0 as null", () => {
    const response = {
      track: { ...fullResponse.track, duration: "0" },
    };
    const result = mapTrackInfo(response);
    assert.equal(result.duration, null);
  });

  it("handles empty mbid string", () => {
    const response = {
      track: { ...fullResponse.track, mbid: "" },
    };
    const result = mapTrackInfo(response);
    assert.equal(result.mbid, null);
  });

  it("handles empty image URLs", () => {
    const response = {
      track: {
        ...fullResponse.track,
        image: [
          { "#text": "", size: "small" },
          { "#text": "", size: "large" },
        ],
      },
    };
    const result = mapTrackInfo(response);
    assert.equal(result.imageUrl, null);
  });

  it("handles missing image array", () => {
    const response = {
      track: { ...fullResponse.track, image: undefined },
    };
    const result = mapTrackInfo(response);
    assert.equal(result.imageUrl, null);
  });

  it("handles missing toptags", () => {
    const response = {
      track: { ...fullResponse.track, toptags: undefined },
    };
    const result = mapTrackInfo(response);
    assert.deepEqual(result.tags, []);
  });

  it("handles empty toptags", () => {
    const response = {
      track: { ...fullResponse.track, toptags: { tag: [] } },
    };
    const result = mapTrackInfo(response);
    assert.deepEqual(result.tags, []);
  });
});

describe("mapTopTags", () => {
  it("maps tags with name and count", () => {
    const response = {
      toptags: {
        tag: [
          { name: "rock", count: 100 },
          { name: "classic rock", count: 78 },
          { name: "70s", count: 45 },
        ],
      },
    };
    const result = mapTopTags(response);
    assert.deepEqual(result, [
      { name: "rock", count: 100 },
      { name: "classic rock", count: 78 },
      { name: "70s", count: 45 },
    ]);
  });

  it("sorts by count descending", () => {
    const response = {
      toptags: {
        tag: [
          { name: "b", count: 10 },
          { name: "a", count: 50 },
          { name: "c", count: 30 },
        ],
      },
    };
    const result = mapTopTags(response);
    assert.equal(result[0].name, "a");
    assert.equal(result[1].name, "c");
    assert.equal(result[2].name, "b");
  });

  it("returns empty array for missing toptags", () => {
    assert.deepEqual(mapTopTags({}), []);
    assert.deepEqual(mapTopTags({ toptags: {} }), []);
    assert.deepEqual(mapTopTags({ toptags: { tag: [] } }), []);
  });

  it("coerces string counts to numbers", () => {
    const response = {
      toptags: {
        tag: [{ name: "rock", count: "100" }],
      },
    };
    const result = mapTopTags(response);
    assert.equal(result[0].count, 100);
    assert.equal(typeof result[0].count, "number");
  });
});
