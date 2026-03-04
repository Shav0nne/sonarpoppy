import {beforeEach, describe, it, mock} from "node:test";
import assert from "node:assert/strict";

// ─── Mongoose / Track stub ────────────────────────────────────────────────────
// We mock the Track model so no real MongoDB connection is needed.
let stubbedFindOne = null;
let stubbedCreate = null;
let stubbedSave = null;

const MockTrack = {
    findOne: async (...args) => stubbedFindOne(...args),
    create: async (...args) => stubbedCreate(...args),
};

// Patch the module registry so ingest.js receives our mock.
// Node test runner supports module mocking via mock.module().
mock.module("../../src/models/Track.js", {
    defaultExport: MockTrack,
});

// Now import (dynamic) AFTER the mock is registered.
const {ingestTrack, ingestBatch} = await import(
    "../../src/services/ingestion/ingest.js"
    );

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal Last.fm client mock. */
function makeClient({
                        trackInfo = defaultTrackInfo(),
                        trackTopTags = [
                            {name: "rock", count: 100},
                            {name: "classic rock", count: 80},
                            {name: "hard rock", count: 60},
                        ],
                        artistTopTags = [{name: "blues", count: 50}],
                        getTrackInfoError = null,
                        getTrackTopTagsError = null,
                        getArtistTopTagsError = null,
                    } = {}) {
    return {
        getTrackInfo: async () => {
            if (getTrackInfoError) throw getTrackInfoError;
            return trackInfo;
        },
        getTrackTopTags: async () => {
            if (getTrackTopTagsError) throw getTrackTopTagsError;
            return trackTopTags;
        },
        getArtistTopTags: async () => {
            if (getArtistTopTagsError) throw getArtistTopTagsError;
            return artistTopTags;
        },
    };
}

function defaultTrackInfo() {
    return {
        title: "Bohemian Rhapsody",
        artist: "Queen",
        album: "A Night at the Opera",
        duration: 354,
        tags: ["rock", "classic rock"],
        lastfmUrl: "https://last.fm/queen/bohemian",
        mbid: "abc-123",
        imageUrl: "https://img.fm/cover.jpg",
    };
}

function makeSavedDoc(overrides = {}) {
    const base = {
        ...defaultTrackInfo(),
        genreVector: new Array(20).fill(0),
        lastfmTags: [],
        save: async function () {
            if (stubbedSave) await stubbedSave(this);
        },
    };
    return {...base, ...overrides};
}

// ─── REQ-001 ingestTrack – happy path ────────────────────────────────────────
describe("ingestTrack – REQ-001: saves a new track", () => {
    beforeEach(() => {
        stubbedFindOne = async () => null; // no existing track
        stubbedCreate = async (doc) => ({_id: "id1", ...doc});
    });

    it("returns status 'saved' with the created track", async () => {
        const client = makeClient();
        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        assert.equal(result.status, "saved");
        assert.ok(result.track);
        assert.equal(result.track.title, "Bohemian Rhapsody");
        assert.equal(result.track.artist, "Queen");
    });

    it("stores lastfmTags on the document", async () => {
        const client = makeClient();
        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        assert.ok(Array.isArray(result.track.lastfmTags));
        assert.ok(result.track.lastfmTags.length > 0);
    });

    it("stores a genreVector of length 20", async () => {
        const client = makeClient();
        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        assert.equal(result.track.genreVector.length, 20);
    });
});

// ─── REQ-006 genreVector calculation ─────────────────────────────────────────
describe("ingestTrack – REQ-006: genreVector is computed via createVector", () => {
    beforeEach(() => {
        stubbedFindOne = async () => null;
        stubbedCreate = async (doc) => ({_id: "id1", ...doc});
    });

    it("produces a non-zero vector for known genre tags", async () => {
        const client = makeClient({
            trackTopTags: [
                {name: "rock", count: 100},
                {name: "pop", count: 80},
                {name: "electronic", count: 60},
            ],
        });
        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody");
        const vec = result.track.genreVector;
        const sum = vec.reduce((a, b) => a + b, 0);
        assert.ok(sum > 0, "genreVector should have positive entries for known tags");
    });

    it("normalizes the vector (sum ≈ 1.0) when genres are found", async () => {
        const client = makeClient({
            trackTopTags: [
                {name: "rock", count: 100},
                {name: "pop", count: 80},
                {name: "jazz", count: 60},
            ],
        });
        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody");
        const vec = result.track.genreVector;
        const sum = vec.reduce((a, b) => a + b, 0);
        assert.ok(Math.abs(sum - 1.0) < 1e-9, `vector sum should be ~1.0, got ${sum}`);
    });

    it("produces a zero vector when no tags map to known genres", async () => {
        const client = makeClient({
            trackTopTags: [{name: "unknowntag-xyz", count: 100}],
            artistTopTags: [{name: "anotherunknown", count: 50}],
        });
        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody");
        const vec = result.track.genreVector;
        const sum = vec.reduce((a, b) => a + b, 0);
        assert.equal(sum, 0);
    });
});

// ─── REQ-002 tag fallback ─────────────────────────────────────────────────────
describe("ingestTrack – REQ-002: artist tag fallback", () => {
    beforeEach(() => {
        stubbedFindOne = async () => null;
    });

    it("uses artist tags when track tags yield fewer than 3 mapped genres", async () => {
        // Only 1 mapped genre from track tags → should trigger fallback
        const artistTagsCalled = {called: false};
        const client = {
            getTrackInfo: async () => defaultTrackInfo(),
            getTrackTopTags: async () => [{name: "rock", count: 100}],
            getArtistTopTags: async () => {
                artistTagsCalled.called = true;
                return [
                    {name: "pop", count: 80},
                    {name: "jazz", count: 60},
                    {name: "blues", count: 40},
                ];
            },
        };

        stubbedCreate = async (doc) => ({_id: "id1", ...doc});
        await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        assert.ok(artistTagsCalled.called, "getArtistTopTags should be called for sparse track tags");
    });

    it("does NOT call artist tags when track tags yield ≥3 mapped genres", async () => {
        const artistTagsCalled = {called: false};
        const client = {
            getTrackInfo: async () => defaultTrackInfo(),
            getTrackTopTags: async () => [
                {name: "rock", count: 100},
                {name: "pop", count: 80},
                {name: "electronic", count: 60},
            ],
            getArtistTopTags: async () => {
                artistTagsCalled.called = true;
                return [];
            },
        };

        stubbedCreate = async (doc) => ({_id: "id1", ...doc});
        await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        assert.equal(artistTagsCalled.called, false, "getArtistTopTags should NOT be called");
    });

    it("merges artist tags with track tags (no duplicates)", async () => {
        const client = {
            getTrackInfo: async () => defaultTrackInfo(),
            getTrackTopTags: async () => [{name: "rock", count: 100}],
            getArtistTopTags: async () => [
                {name: "rock", count: 90}, // duplicate – should not be doubled
                {name: "pop", count: 70},
                {name: "blues", count: 50},
            ],
        };

        let savedDoc = null;
        stubbedCreate = async (doc) => {
            savedDoc = doc;
            return {_id: "id1", ...doc};
        };

        await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        const tags = savedDoc.lastfmTags;
        const rockOccurrences = tags.filter((t) => t.toLowerCase() === "rock").length;
        assert.equal(rockOccurrences, 1, "rock should appear only once in merged tags");
    });
});

// ─── REQ-003 skip / force ─────────────────────────────────────────────────────
describe("ingestTrack – REQ-003: skip existing / force update", () => {
    it("skips when track exists and force=false (default)", async () => {
        const existingTrack = makeSavedDoc();
        stubbedFindOne = async () => existingTrack;
        stubbedCreate = async () => {
            throw new Error("create should not be called");
        };

        const client = makeClient();
        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        assert.equal(result.status, "skipped");
        assert.equal(result.track, existingTrack);
    });

    it("updates when track exists and force=true", async () => {
        let saveCalled = false;
        const existingTrack = makeSavedDoc({
            save: async function () {
                saveCalled = true;
            },
        });
        stubbedFindOne = async () => existingTrack;
        stubbedCreate = async () => {
            throw new Error("create should not be called on force update");
        };

        const client = makeClient();
        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody", {force: true});

        assert.equal(result.status, "updated");
        assert.ok(saveCalled, "save() should have been called on force update");
    });

    it("saves when track does not exist", async () => {
        stubbedFindOne = async () => null;
        stubbedCreate = async (doc) => ({_id: "newid", ...doc});

        const client = makeClient();
        const result = await ingestTrack(client, "New Artist", "New Song");

        assert.equal(result.status, "saved");
    });
});

// ─── REQ-005 graceful error handling ─────────────────────────────────────────
describe("ingestTrack – REQ-005: graceful error handling", () => {
    it("returns status 'error' when getTrackInfo throws", async () => {
        stubbedFindOne = async () => null;

        const client = makeClient({getTrackInfoError: new Error("Last.fm unavailable")});
        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        assert.equal(result.status, "error");
        assert.ok(result.error instanceof Error);
        assert.equal(result.error.message, "Last.fm unavailable");
    });

    it("returns status 'error' when getTrackTopTags throws", async () => {
        stubbedFindOne = async () => null;

        const client = makeClient({getTrackTopTagsError: new Error("tags fetch failed")});
        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        assert.equal(result.status, "error");
        assert.ok(result.error instanceof Error);
    });

    it("returns status 'error' when Track.create throws", async () => {
        stubbedFindOne = async () => null;
        stubbedCreate = async () => {
            throw new Error("DB write failed");
        };

        const client = makeClient();
        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        assert.equal(result.status, "error");
        assert.equal(result.error.message, "DB write failed");
    });

    it("does not throw — always returns a result object", async () => {
        stubbedFindOne = async () => {
            throw new Error("DB connection lost");
        };

        const client = makeClient();
        await assert.doesNotReject(() => ingestTrack(client, "Queen", "Bohemian Rhapsody"));
    });
});

// ─── REQ-004 ingestBatch ──────────────────────────────────────────────────────
describe("ingestBatch – REQ-004: processes multiple tracks sequentially", () => {
    beforeEach(() => {
        stubbedFindOne = async () => null;
        stubbedCreate = async (doc) => ({_id: "id-" + Math.random(), ...doc});
    });

    it("returns an array with one result per input track", async () => {
        const client = makeClient();
        const tracks = [
            {artist: "Queen", title: "Bohemian Rhapsody"},
            {artist: "Radiohead", title: "Creep"},
        ];

        const results = await ingestBatch(client, tracks);

        assert.equal(results.length, 2);
    });

    it("each result contains artist and title", async () => {
        const client = makeClient();
        const tracks = [
            {artist: "Queen", title: "Bohemian Rhapsody"},
            {artist: "Radiohead", title: "Creep"},
        ];

        const results = await ingestBatch(client, tracks);

        assert.equal(results[0].artist, "Queen");
        assert.equal(results[0].title, "Bohemian Rhapsody");
        assert.equal(results[1].artist, "Radiohead");
        assert.equal(results[1].title, "Creep");
    });

    it("does not throw when one track fails", async () => {
        let callCount = 0;
        const client = {
            getTrackInfo: async () => {
                callCount++;
                if (callCount === 1) throw new Error("first track fails");
                return defaultTrackInfo();
            },
            getTrackTopTags: async () => [
                {name: "rock", count: 100},
                {name: "pop", count: 80},
                {name: "electronic", count: 60},
            ],
            getArtistTopTags: async () => [],
        };

        const tracks = [
            {artist: "Bad Artist", title: "Bad Song"},
            {artist: "Queen", title: "Bohemian Rhapsody"},
        ];

        const results = await ingestBatch(client, tracks);

        assert.equal(results[0].status, "error");
        assert.equal(results[1].status, "saved");
    });

    it("passes force option to each ingestTrack call", async () => {
        const existingTrack = makeSavedDoc({
            save: async function () {
            }
        });
        stubbedFindOne = async () => existingTrack;

        const client = makeClient();
        const tracks = [{artist: "Queen", title: "Bohemian Rhapsody"}];

        const results = await ingestBatch(client, tracks, {force: true});
        assert.equal(results[0].status, "updated");
    });

    it("processes an empty array without error", async () => {
        const client = makeClient();
        const results = await ingestBatch(client, []);
        assert.deepEqual(results, []);
    });
});

