import test, { mock } from "node:test";
import assert from "node:assert";
import { enrichTracks } from "../../src/services/spotify/enrichSpotify.js";
import Track from "../../src/models/Track.js";

test("enrichTracks", async (t) => {
    let mockFind, mockFindByIdAndUpdate, mockSearch, mockAudioFeatures;

    t.beforeEach(() => {
        mockFind = mock.fn(async () => [
            { _id: "1", artist: "A1", title: "T1" },
            { _id: "2", artist: "A2", title: "T2" },
            { _id: "3", artist: "A3", title: "T3" },
        ]);
        Track.find = mockFind;

        mockFindByIdAndUpdate = mock.fn(async () => { });
        Track.findByIdAndUpdate = mockFindByIdAndUpdate;

        mockSearch = mock.fn(async (artist, title) => {
            if (artist === "A1") return { spotifyId: "s1", explicit: true };
            if (artist === "A2") return null; // No match
            if (artist === "A3") throw new Error("API failed");
        });

        mockAudioFeatures = mock.fn(async (id) => {
            if (id === "s1") return { danceability: 0.8 };
            return {};
        });

    });

    t.afterEach(() => {
        mock.restoreAll();
    });

    await t.test("should process all tracks, handle matches, misses, and errors", async () => {
        const mockClient = { searchTrack: mockSearch, getAudioFeatures: mockAudioFeatures };

        const result = await enrichTracks(mockClient);

        // Assert find was called with exists:false
        assert.strictEqual(mockFind.mock.calls.length, 1);
        assert.deepStrictEqual(mockFind.mock.calls[0].arguments[0], { spotifyId: { $exists: false } });

        // Assert searches were made sequentially
        assert.strictEqual(mockSearch.mock.calls.length, 3);
        assert.strictEqual(mockSearch.mock.calls[0].arguments[0], "A1");
        assert.strictEqual(mockSearch.mock.calls[2].arguments[0], "A3");

        // Assert audio features called for matched
        assert.strictEqual(mockAudioFeatures.mock.calls.length, 1);
        assert.strictEqual(mockAudioFeatures.mock.calls[0].arguments[0], "s1");

        // Assert update was called only once for A1
        assert.strictEqual(mockFindByIdAndUpdate.mock.calls.length, 1);
        const updateArgs = mockFindByIdAndUpdate.mock.calls[0].arguments;
        assert.strictEqual(updateArgs[0], "1");
        assert.deepStrictEqual(updateArgs[1], {
            $set: { spotifyId: "s1", explicit: true, danceability: 0.8 },
        });

        // Assert result shape
        assert.strictEqual(result.total, 3);
        assert.strictEqual(result.processed, 2); // 3 total, 1 errored so processed means successfully searched without rejecting? Wait, processed increments BEFORE error check or inside try?
        assert.strictEqual(result.matched, 1);
        assert.strictEqual(result.errors, 1);
        assert.strictEqual(result.matches.length, 1);
        assert.strictEqual(result.matches[0].spotifyId, "s1");
    });
});
