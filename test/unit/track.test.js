import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Import will fail until Track.js exists — that's the RED phase
import Track from "../../src/models/Track.js";

// REQ-001: Schema velden en types
describe("Track schema velden", () => {
  it("heeft alle verwachte paden", () => {
    const paths = Object.keys(Track.schema.paths);
    const expected = [
      "title",
      "artist",
      "album",
      "duration",
      "genreVector",
      "lastfmUrl",
      "lastfmTags",
      "mbid",
      "imageUrl",
      "createdAt",
      "updatedAt",
      "_id",
      "__v",
    ];
    for (const field of expected) {
      assert.ok(paths.includes(field), `missing path: ${field}`);
    }
  });

  it("title is required en trim", () => {
    const titlePath = Track.schema.path("title");
    assert.equal(titlePath.options.type, String);
    assert.equal(titlePath.options.required, true);
    assert.equal(titlePath.options.trim, true);
  });

  it("artist is required en trim", () => {
    const artistPath = Track.schema.path("artist");
    assert.equal(artistPath.options.type, String);
    assert.equal(artistPath.options.required, true);
    assert.equal(artistPath.options.trim, true);
  });

  it("album is optional met trim", () => {
    const albumPath = Track.schema.path("album");
    assert.equal(albumPath.options.type, String);
    assert.equal(albumPath.options.trim, true);
    assert.equal(albumPath.options.required, undefined);
  });

  it("duration is Number met min 0", () => {
    const durationPath = Track.schema.path("duration");
    assert.equal(durationPath.options.type, Number);
    assert.equal(durationPath.options.min, 0);
  });

  it("genreVector is array van Numbers", () => {
    const gvPath = Track.schema.path("genreVector");
    assert.ok(gvPath, "genreVector path bestaat");
  });

  it("lastfmUrl is String", () => {
    const p = Track.schema.path("lastfmUrl");
    assert.equal(p.options.type, String);
  });

  it("lastfmTags is array van Strings", () => {
    const p = Track.schema.path("lastfmTags");
    assert.ok(p, "lastfmTags path bestaat");
  });

  it("mbid is String", () => {
    const p = Track.schema.path("mbid");
    assert.equal(p.options.type, String);
  });

  it("imageUrl is String", () => {
    const p = Track.schema.path("imageUrl");
    assert.equal(p.options.type, String);
  });

  it("timestamps zijn enabled", () => {
    assert.ok(Track.schema.paths.createdAt, "createdAt exists");
    assert.ok(Track.schema.paths.updatedAt, "updatedAt exists");
  });

  it("title faalt validateSync zonder waarde", () => {
    const track = new Track({ artist: "Test" });
    const err = track.validateSync();
    assert.ok(err);
    assert.ok(err.errors.title);
  });

  it("artist faalt validateSync zonder waarde", () => {
    const track = new Track({ title: "Test" });
    const err = track.validateSync();
    assert.ok(err);
    assert.ok(err.errors.artist);
  });

  it("duration faalt bij negatieve waarde", () => {
    const track = new Track({
      title: "Test",
      artist: "Test",
      duration: -1,
    });
    const err = track.validateSync();
    assert.ok(err);
    assert.ok(err.errors.duration);
  });
});

// REQ-002: genreVector validatie
describe("genreVector validatie", () => {
  const validVector = new Array(20).fill(0.5);
  const baseTrack = { title: "Test", artist: "Test" };

  it("accepteert geldige vector van 20 floats (0-1)", () => {
    const track = new Track({ ...baseTrack, genreVector: validVector });
    const err = track.validateSync();
    assert.equal(err, undefined);
  });

  it("faalt bij vector met minder dan 20 items", () => {
    const track = new Track({
      ...baseTrack,
      genreVector: new Array(19).fill(0.5),
    });
    const err = track.validateSync();
    assert.ok(err);
    assert.ok(err.errors.genreVector);
  });

  it("faalt bij vector met meer dan 20 items", () => {
    const track = new Track({
      ...baseTrack,
      genreVector: new Array(21).fill(0.5),
    });
    const err = track.validateSync();
    assert.ok(err);
    assert.ok(err.errors.genreVector);
  });

  it("faalt bij waarde groter dan 1.0", () => {
    const vec = new Array(20).fill(0.5);
    vec[0] = 1.1;
    const track = new Track({ ...baseTrack, genreVector: vec });
    const err = track.validateSync();
    assert.ok(err);
    assert.ok(err.errors.genreVector);
  });

  it("faalt bij waarde kleiner dan 0.0", () => {
    const vec = new Array(20).fill(0.5);
    vec[0] = -0.1;
    const track = new Track({ ...baseTrack, genreVector: vec });
    const err = track.validateSync();
    assert.ok(err);
    assert.ok(err.errors.genreVector);
  });

  it("accepteert grenswaarden 0.0 en 1.0", () => {
    const vec = new Array(20).fill(0);
    vec[0] = 0.0;
    vec[19] = 1.0;
    const track = new Track({ ...baseTrack, genreVector: vec });
    const err = track.validateSync();
    assert.equal(err, undefined);
  });

  it("accepteert lege genreVector (optioneel veld)", () => {
    const track = new Track(baseTrack);
    const err = track.validateSync();
    assert.equal(err, undefined);
  });
});

// REQ-003: Zero-vector guard
describe("genreVector zero-vector guard", () => {
  it("accepteert zero-vector (20x 0.0)", () => {
    const zeroVector = new Array(20).fill(0);
    const track = new Track({
      title: "Test",
      artist: "Test",
      genreVector: zeroVector,
    });
    const err = track.validateSync();
    assert.equal(err, undefined);
  });
});

// CF enrichment velden
describe("CF enrichment velden", () => {
  const baseTrack = { title: "Test", artist: "Test" };

  it("heeft similarTracks, similarArtists, cfEnrichedAt paden", () => {
    const paths = Object.keys(Track.schema.paths);
    assert.ok(paths.includes("cfEnrichedAt"), "missing: cfEnrichedAt");
    assert.ok(Track.schema.path("similarTracks"), "missing: similarTracks");
    assert.ok(Track.schema.path("similarArtists"), "missing: similarArtists");
  });

  it("accepteert similarTracks met artist, title, match", () => {
    const track = new Track({
      ...baseTrack,
      similarTracks: [{ artist: "Queen", title: "Under Pressure", match: 0.85 }],
    });
    const err = track.validateSync();
    assert.equal(err, undefined);
    assert.equal(track.similarTracks[0].artist, "Queen");
    assert.equal(track.similarTracks[0].title, "Under Pressure");
    assert.equal(track.similarTracks[0].match, 0.85);
  });

  it("accepteert similarArtists met artist, match", () => {
    const track = new Track({
      ...baseTrack,
      similarArtists: [{ artist: "David Bowie", match: 0.92 }],
    });
    const err = track.validateSync();
    assert.equal(err, undefined);
    assert.equal(track.similarArtists[0].artist, "David Bowie");
    assert.equal(track.similarArtists[0].match, 0.92);
  });

  it("cfEnrichedAt defaults to null", () => {
    const track = new Track(baseTrack);
    assert.equal(track.cfEnrichedAt, null);
  });

  it("accepteert cfEnrichedAt als Date", () => {
    const now = new Date();
    const track = new Track({ ...baseTrack, cfEnrichedAt: now });
    const err = track.validateSync();
    assert.equal(err, undefined);
    assert.deepEqual(track.cfEnrichedAt, now);
  });

  it("faalt bij similarTracks match buiten 0-1", () => {
    const track = new Track({
      ...baseTrack,
      similarTracks: [{ artist: "A", title: "B", match: 1.5 }],
    });
    const err = track.validateSync();
    assert.ok(err);
  });

  it("faalt bij similarArtists match buiten 0-1", () => {
    const track = new Track({
      ...baseTrack,
      similarArtists: [{ artist: "A", match: -0.1 }],
    });
    const err = track.validateSync();
    assert.ok(err);
  });
});
