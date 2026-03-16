import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ArtistImage from "../../src/models/ArtistImage.js";

const validDoc = {
  artist: "Radiohead",
  images: [
    { url: "https://img.fm/small.jpg", size: "small" },
    { url: "https://img.fm/large.jpg", size: "large" },
  ],
  fetchedAt: new Date(),
};

describe("ArtistImage schema velden", () => {
  it("heeft alle verwachte paden", () => {
    const paths = Object.keys(ArtistImage.schema.paths);
    const expected = ["artist", "images", "fetchedAt", "_id", "__v"];
    for (const field of expected) {
      assert.ok(paths.includes(field), `missing path: ${field}`);
    }
  });

  it("artist is required String met lowercase", () => {
    const p = ArtistImage.schema.path("artist");
    assert.equal(p.options.type, String);
    assert.equal(p.options.required, true);
    assert.equal(p.options.lowercase, true);
  });

  it("images is een array met url en size subdocumenten", () => {
    const doc = new ArtistImage(validDoc);
    assert.equal(doc.images.length, 2);
    assert.equal(doc.images[0].url, "https://img.fm/small.jpg");
    assert.equal(doc.images[0].size, "small");
  });

  it("fetchedAt defaults naar nu", () => {
    const doc = new ArtistImage({ artist: "test", images: [] });
    assert.ok(doc.fetchedAt instanceof Date);
  });
});

describe("ArtistImage lowercase", () => {
  it("slaat artist op als lowercase", () => {
    const doc = new ArtistImage({ ...validDoc, artist: "RADIOHEAD" });
    assert.equal(doc.artist, "radiohead");
  });
});

describe("ArtistImage validatie", () => {
  it("accepteert geldig document", () => {
    const doc = new ArtistImage(validDoc);
    const err = doc.validateSync();
    assert.equal(err, undefined);
  });

  it("faalt zonder artist", () => {
    const doc = new ArtistImage({ ...validDoc, artist: undefined });
    const err = doc.validateSync();
    assert.ok(err);
    assert.ok(err.errors.artist);
  });
});

describe("ArtistImage indexen", () => {
  it("heeft unique index op artist", () => {
    const indexes = ArtistImage.schema.indexes();
    const artistIdx = indexes.find(([fields]) => fields.artist === 1);
    assert.ok(artistIdx, "artist index exists");
    assert.equal(artistIdx[1].unique, true);
  });
});
