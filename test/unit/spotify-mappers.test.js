import test from "node:test";
import assert from "node:assert";
import { mapSpotifyTrack, mapAudioFeatures } from "../../src/services/spotify/mappers.js";

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

test("mapAudioFeatures", async (t) => {
    await t.test("should map complete audio features", () => {
        const mockFeatures = {
            danceability: 0.8,
            tempo: 120.5,
            acousticness: 0.1,
            energy: 0.9,
            instrumentalness: 0.0,
            key: 5,
            liveness: 0.2,
            loudness: -5.4,
            mode: 1,
            speechiness: 0.05,
            time_signature: 4,
            valence: 0.7,
            ignore_this: "should be ignored",
        };

        const result = mapAudioFeatures(mockFeatures);

        assert.deepStrictEqual(result, {
            danceability: 0.8,
            tempo: 120.5,
            acousticness: 0.1,
            energy: 0.9,
            instrumentalness: 0.0,
            key: 5,
            liveness: 0.2,
            loudness: -5.4,
            mode: 1,
            speechiness: 0.05,
            time_signature: 4,
            valence: 0.7,
        });
    });

    await t.test("should handle empty features", () => {
        assert.deepStrictEqual(mapAudioFeatures(null), {});
        assert.deepStrictEqual(mapAudioFeatures(undefined), {});
    });
});
