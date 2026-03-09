import test from "node:test";
import assert from "node:assert";
import { mapSpotifyTrack } from "../../src/services/spotify/mappers.js";

test("mapSpotifyTrack", async (t) => {
  await t.test("should map a complete Spotify track item", () => {
    const mockItem = {
      id: "123",
      uri: "spotify:track:123",
      duration_ms: 215000,
      explicit: true,
      album: {
        images: [
          { url: "img640", height: 640, width: 640 },
          { url: "img300", height: 300, width: 300 },
          { url: "img64", height: 64, width: 64 },
        ],
      },
    };

    const result = mapSpotifyTrack(mockItem);

    assert.deepStrictEqual(result, {
      spotifyId: "123",
      spotifyUri: "spotify:track:123",
      duration: 215,
      explicit: true,
      albumImages: [
        { url: "img640", height: 640, width: 640 },
        { url: "img300", height: 300, width: 300 },
        { url: "img64", height: 64, width: 64 },
      ],
    });
  });

  await t.test("should handle missing optional fields gracefully", () => {
    const mockItem = {
      id: "456",
      uri: "spotify:track:456",
      duration_ms: 0,
    };

    const result = mapSpotifyTrack(mockItem);

    assert.deepStrictEqual(result, {
      spotifyId: "456",
      spotifyUri: "spotify:track:456",
      duration: null,
      explicit: false,
      albumImages: [],
    });
  });

  await t.test("should return null for null input", () => {
    assert.strictEqual(mapSpotifyTrack(null), null);
    assert.strictEqual(mapSpotifyTrack(undefined), null);
  });
});
