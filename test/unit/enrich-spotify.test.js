import test, { mock } from "node:test";
import assert from "node:assert";
import { enrichTracks } from "../../src/services/spotify/enrichSpotify.js";
import Track from "../../src/models/Track.js";

test("enrichTracks", async (t) => {
  let mockFind, mockFindByIdAndUpdate, mockSearch;

  t.beforeEach(() => {
    mockFind = mock.fn(async () => [
      { _id: "1", artist: "A1", title: "T1" },
      { _id: "2", artist: "A2", title: "T2" },
      { _id: "3", artist: "A3", title: "T3" },
    ]);
    // Mock the chained .limit() call
    mockFind.mock.implementation = async () => [
      { _id: "1", artist: "A1", title: "T1" },
      { _id: "2", artist: "A2", title: "T2" },
      { _id: "3", artist: "A3", title: "T3" },
    ];
    Track.find = (...args) => {
      mockFind(...args);
      return { limit: () => mockFind.mock.calls[mockFind.mock.calls.length - 1].result };
    };

    mockFindByIdAndUpdate = mock.fn(async () => {});
    Track.findByIdAndUpdate = mockFindByIdAndUpdate;

    mockSearch = mock.fn(async (artist, title) => {
      if (artist === "A1") return { spotifyId: "s1", explicit: true };
      if (artist === "A2") return null; // No match
      if (artist === "A3") throw new Error("API failed");
    });
  });

  t.afterEach(() => {
    mock.restoreAll();
  });

  await t.test("should process all tracks, handle matches, misses, and errors", async () => {
    const mockClient = { searchTrack: mockSearch };

    const result = await enrichTracks(mockClient);

    // Assert searches were made sequentially
    assert.strictEqual(mockSearch.mock.calls.length, 3);
    assert.strictEqual(mockSearch.mock.calls[0].arguments[0], "A1");
    assert.strictEqual(mockSearch.mock.calls[2].arguments[0], "A3");

    // Assert update was called only once for A1
    assert.strictEqual(mockFindByIdAndUpdate.mock.calls.length, 1);
    const updateArgs = mockFindByIdAndUpdate.mock.calls[0].arguments;
    assert.strictEqual(updateArgs[0], "1");
    assert.deepStrictEqual(updateArgs[1], {
      $set: { spotifyId: "s1", explicit: true },
    });

    // Assert result shape (new format)
    assert.strictEqual(result.total, 3);
    assert.strictEqual(result.enriched, 1);
    assert.strictEqual(result.skipped, 1); // A2 returned null
    assert.strictEqual(result.failed, 1); // A3 threw
    assert.ok(Array.isArray(result.errors));
    assert.strictEqual(result.errors.length, 1);
    assert.ok(result.errors[0].includes("API failed"));
  });

  await t.test("should call onProgress after each track", async () => {
    const progressCalls = [];
    const mockClient = { searchTrack: mockSearch };

    await enrichTracks(mockClient, {
      onProgress: (p) => progressCalls.push({ ...p }),
    });

    assert.strictEqual(progressCalls.length, 3);
    // After A1 (enriched)
    assert.strictEqual(progressCalls[0].enriched, 1);
    assert.strictEqual(progressCalls[0].current, 1);
    // After A2 (skipped)
    assert.strictEqual(progressCalls[1].skipped, 1);
    assert.strictEqual(progressCalls[1].current, 2);
    // After A3 (failed)
    assert.strictEqual(progressCalls[2].failed, 1);
    assert.strictEqual(progressCalls[2].current, 3);
  });
});
