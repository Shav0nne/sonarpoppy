import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapArtistInfo } from "../../src/services/lastfm/mappers.js";

describe("mapArtistInfo", () => {
  it("mapt artist.getInfo response naar artist info met images", () => {
    const response = {
      artist: {
        name: "Radiohead",
        mbid: "a74b1b7f-71a5-4011-9441-d0b5e4122711",
        url: "https://www.last.fm/music/Radiohead",
        image: [
          { "#text": "https://img.fm/small.jpg", size: "small" },
          { "#text": "https://img.fm/medium.jpg", size: "medium" },
          { "#text": "https://img.fm/large.jpg", size: "large" },
          { "#text": "https://img.fm/extralarge.jpg", size: "extralarge" },
        ],
      },
    };

    const result = mapArtistInfo(response);

    assert.equal(result.name, "Radiohead");
    assert.equal(result.mbid, "a74b1b7f-71a5-4011-9441-d0b5e4122711");
    assert.equal(result.url, "https://www.last.fm/music/Radiohead");
    assert.equal(result.images.length, 4);
    assert.equal(result.images[0].url, "https://img.fm/small.jpg");
    assert.equal(result.images[0].size, "small");
    assert.equal(result.images[3].url, "https://img.fm/extralarge.jpg");
    assert.equal(result.images[3].size, "extralarge");
  });

  it("filtert lege image URLs", () => {
    const response = {
      artist: {
        name: "Test",
        url: "https://last.fm/test",
        image: [
          { "#text": "", size: "small" },
          { "#text": "https://img.fm/large.jpg", size: "large" },
        ],
      },
    };

    const result = mapArtistInfo(response);
    assert.equal(result.images.length, 1);
    assert.equal(result.images[0].size, "large");
  });

  it("retourneert lege images array als geen images", () => {
    const response = {
      artist: {
        name: "Test",
        url: "https://last.fm/test",
      },
    };

    const result = mapArtistInfo(response);
    assert.deepEqual(result.images, []);
  });

  it("mbid is null als leeg of afwezig", () => {
    const response = {
      artist: {
        name: "Test",
        mbid: "",
        url: "https://last.fm/test",
        image: [],
      },
    };

    const result = mapArtistInfo(response);
    assert.equal(result.mbid, null);
  });
});
