import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapTrackInfo,
  mapTopTags,
  mapSimilarTracks,
  mapSimilarArtists,
  mapArtistSearch,
} from "../../src/services/lastfm/mappers.js";

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

describe("mapSimilarTracks", () => {
  const fullResponse = {
    similartracks: {
      track: [
        {
          name: "Under Pressure",
          match: "0.85",
          artist: { name: "Queen", "#text": "Queen" },
        },
        {
          name: "We Will Rock You",
          match: "0.72",
          artist: { name: "Queen", "#text": "Queen" },
        },
      ],
    },
  };

  it("maps similar tracks with artist, title, match", () => {
    const result = mapSimilarTracks(fullResponse);
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { artist: "Queen", title: "Under Pressure", match: 0.85 });
    assert.deepEqual(result[1], { artist: "Queen", title: "We Will Rock You", match: 0.72 });
  });

  it("coerces match from string to number", () => {
    const result = mapSimilarTracks(fullResponse);
    assert.equal(typeof result[0].match, "number");
  });

  it("uses #text fallback for artist name", () => {
    const response = {
      similartracks: {
        track: [{ name: "Song", match: "0.5", artist: { "#text": "ArtistViaText" } }],
      },
    };
    const result = mapSimilarTracks(response);
    assert.equal(result[0].artist, "ArtistViaText");
  });

  it("returns empty array for missing similartracks", () => {
    assert.deepEqual(mapSimilarTracks({}), []);
    assert.deepEqual(mapSimilarTracks({ similartracks: {} }), []);
    assert.deepEqual(mapSimilarTracks({ similartracks: { track: [] } }), []);
  });

  it("filters out entries with invalid match", () => {
    const response = {
      similartracks: {
        track: [
          { name: "Good", match: "0.5", artist: { name: "A" } },
          { name: "Bad", match: "", artist: { name: "B" } },
          { name: "Missing", artist: { name: "C" } },
        ],
      },
    };
    const result = mapSimilarTracks(response);
    assert.equal(result.length, 1);
    assert.equal(result[0].title, "Good");
  });

  it("filters out entries without artist", () => {
    const response = {
      similartracks: {
        track: [
          { name: "Good", match: "0.5", artist: { name: "A" } },
          { name: "NoArtist", match: "0.5" },
          { name: "EmptyArtist", match: "0.5", artist: {} },
        ],
      },
    };
    const result = mapSimilarTracks(response);
    assert.equal(result.length, 1);
    assert.equal(result[0].title, "Good");
  });
});

describe("mapSimilarArtists", () => {
  const fullResponse = {
    similarartists: {
      artist: [
        { name: "David Bowie", match: "0.92" },
        { name: "Led Zeppelin", match: "0.78" },
      ],
    },
  };

  it("maps similar artists with artist and match", () => {
    const result = mapSimilarArtists(fullResponse);
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { artist: "David Bowie", match: 0.92 });
    assert.deepEqual(result[1], { artist: "Led Zeppelin", match: 0.78 });
  });

  it("coerces match from string to number", () => {
    const result = mapSimilarArtists(fullResponse);
    assert.equal(typeof result[0].match, "number");
  });

  it("returns empty array for missing similarartists", () => {
    assert.deepEqual(mapSimilarArtists({}), []);
    assert.deepEqual(mapSimilarArtists({ similarartists: {} }), []);
    assert.deepEqual(mapSimilarArtists({ similarartists: { artist: [] } }), []);
  });

  it("filters out entries with invalid match", () => {
    const response = {
      similarartists: {
        artist: [
          { name: "Good", match: "0.5" },
          { name: "Bad", match: "" },
        ],
      },
    };
    const result = mapSimilarArtists(response);
    assert.equal(result.length, 1);
    assert.equal(result[0].artist, "Good");
  });

  it("filters out entries without name", () => {
    const response = {
      similarartists: {
        artist: [{ name: "Good", match: "0.5" }, { match: "0.5" }, { name: "", match: "0.5" }],
      },
    };
    const result = mapSimilarArtists(response);
    assert.equal(result.length, 1);
    assert.equal(result[0].artist, "Good");
  });
});

describe("mapArtistSearch", () => {
  it("maps artist search results to [{ name }]", () => {
    const response = {
      results: {
        artistmatches: {
          artist: [
            {
              name: "Radiohead",
              listeners: "5000000",
              mbid: "abc",
              url: "https://last.fm/radiohead",
            },
            {
              name: "Radio Dept.",
              listeners: "300000",
              mbid: "def",
              url: "https://last.fm/radiodept",
            },
          ],
        },
      },
    };
    const result = mapArtistSearch(response);
    assert.deepEqual(result, [{ name: "Radiohead" }, { name: "Radio Dept." }]);
  });

  it("returns empty array for missing artistmatches", () => {
    assert.deepEqual(mapArtistSearch({}), []);
    assert.deepEqual(mapArtistSearch({ results: {} }), []);
    assert.deepEqual(mapArtistSearch({ results: { artistmatches: {} } }), []);
    assert.deepEqual(mapArtistSearch({ results: { artistmatches: { artist: [] } } }), []);
  });

  it("filters out entries without name", () => {
    const response = {
      results: {
        artistmatches: {
          artist: [{ name: "Good" }, { name: "" }, {}],
        },
      },
    };
    const result = mapArtistSearch(response);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Good");
  });
});
