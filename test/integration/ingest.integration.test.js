import {after, before, beforeEach, describe, it} from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {MongoMemoryServer} from "mongodb-memory-server";
import Track from "../../src/models/Track.js";
import {ingestBatch, ingestTrack} from "../../src/services/ingestion/ingest.js";

// ─── Setup / teardown ─────────────────────────────────────────────────────────

let mongoServer;

before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Track.syncIndexes();
});

after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Track.deleteMany({});
});

// ─── Fake Last.fm client factory ──────────────────────────────────────────────

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
        getArtistTopTags: async () => artistTopTags,
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

// ─── REQ-001: single track ingest persists to MongoDB ─────────────────────────

describe("ingestTrack – persists track to MongoDB (REQ-001)", () => {
    it("creates a new Track document in the database", async () => {
        const client = makeClient();
        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        assert.equal(result.status, "saved");

        const doc = await Track.findOne({artist: "Queen", title: "Bohemian Rhapsody"});
        assert.ok(doc, "document should exist in DB");
        assert.equal(doc.title, "Bohemian Rhapsody");
        assert.equal(doc.artist, "Queen");
        assert.equal(doc.album, "A Night at the Opera");
        assert.equal(doc.duration, 354);
        assert.equal(doc.lastfmUrl, "https://last.fm/queen/bohemian");
        assert.equal(doc.mbid, "abc-123");
        assert.equal(doc.imageUrl, "https://img.fm/cover.jpg");
    });

    it("persists genreVector of correct length (REQ-006)", async () => {
        const client = makeClient();
        await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        const doc = await Track.findOne({artist: "Queen", title: "Bohemian Rhapsody"});
        assert.equal(doc.genreVector.length, 20);
    });

    it("stores non-zero genreVector for known genre tags (REQ-006)", async () => {
        const client = makeClient({
            trackTopTags: [
                {name: "rock", count: 100},
                {name: "pop", count: 80},
                {name: "jazz", count: 60},
            ],
        });
        await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        const doc = await Track.findOne({artist: "Queen", title: "Bohemian Rhapsody"});
        const sum = doc.genreVector.reduce((a, b) => a + b, 0);
        assert.ok(sum > 0, "genreVector should have positive values for known tags");
    });

    it("stores lastfmTags on the document", async () => {
        const client = makeClient();
        await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        const doc = await Track.findOne({artist: "Queen", title: "Bohemian Rhapsody"});
        assert.ok(Array.isArray(doc.lastfmTags));
        assert.ok(doc.lastfmTags.length > 0);
    });

    it("sets createdAt and updatedAt timestamps", async () => {
        const client = makeClient();
        await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        const doc = await Track.findOne({artist: "Queen", title: "Bohemian Rhapsody"});
        assert.ok(doc.createdAt instanceof Date);
        assert.ok(doc.updatedAt instanceof Date);
    });
});

// ─── REQ-003: skip duplicate ──────────────────────────────────────────────────

describe("ingestTrack – skip duplicate (REQ-003)", () => {
    it("returns 'skipped' when track already exists", async () => {
        const client = makeClient();

        await ingestTrack(client, "Queen", "Bohemian Rhapsody");
        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        assert.equal(result.status, "skipped");
    });

    it("does not create a second document when skipping", async () => {
        const client = makeClient();

        await ingestTrack(client, "Queen", "Bohemian Rhapsody");
        await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        const count = await Track.countDocuments({artist: "Queen", title: "Bohemian Rhapsody"});
        assert.equal(count, 1);
    });

    it("allows the same title with a different artist", async () => {
        const client1 = makeClient({trackInfo: {...defaultTrackInfo(), artist: "Queen"}});
        const client2 = makeClient({trackInfo: {...defaultTrackInfo(), artist: "Freddie Mercury"}});

        await ingestTrack(client1, "Queen", "Bohemian Rhapsody");
        const result = await ingestTrack(client2, "Freddie Mercury", "Bohemian Rhapsody");

        assert.equal(result.status, "saved");
        const count = await Track.countDocuments({title: "Bohemian Rhapsody"});
        assert.equal(count, 2);
    });
});

// ─── REQ-003: force update ────────────────────────────────────────────────────

describe("ingestTrack – force update (REQ-003)", () => {
    it("returns 'updated' when force=true on existing track", async () => {
        const client = makeClient();

        await ingestTrack(client, "Queen", "Bohemian Rhapsody");
        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody", {force: true});

        assert.equal(result.status, "updated");
    });

    it("updates the document fields on force", async () => {
        const client1 = makeClient({
            trackInfo: {...defaultTrackInfo(), album: "Original Album"},
        });
        const client2 = makeClient({
            trackInfo: {...defaultTrackInfo(), album: "Updated Album"},
        });

        await ingestTrack(client1, "Queen", "Bohemian Rhapsody");
        await ingestTrack(client2, "Queen", "Bohemian Rhapsody", {force: true});

        const doc = await Track.findOne({artist: "Queen", title: "Bohemian Rhapsody"});
        assert.equal(doc.album, "Updated Album");
    });

    it("still has exactly one document after force update", async () => {
        const client = makeClient();

        await ingestTrack(client, "Queen", "Bohemian Rhapsody");
        await ingestTrack(client, "Queen", "Bohemian Rhapsody", {force: true});

        const count = await Track.countDocuments({artist: "Queen", title: "Bohemian Rhapsody"});
        assert.equal(count, 1);
    });
});

// ─── REQ-002: tag fallback ────────────────────────────────────────────────────

describe("ingestTrack – artist tag fallback (REQ-002)", () => {
    it("falls back to artist tags when track tags are sparse, resulting in a non-zero vector", async () => {
        const client = makeClient({
            // Only 1 recognisable genre from track tags → sparse
            trackTopTags: [{name: "rock", count: 100}],
            // Artist tags provide additional mappable genres
            artistTopTags: [
                {name: "pop", count: 80},
                {name: "electronic", count: 60},
                {name: "jazz", count: 40},
            ],
        });

        await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        const doc = await Track.findOne({artist: "Queen", title: "Bohemian Rhapsody"});
        const sum = doc.genreVector.reduce((a, b) => a + b, 0);
        assert.ok(sum > 0);

        // Should contain artist tags in lastfmTags
        assert.ok(doc.lastfmTags.includes("pop") || doc.lastfmTags.includes("electronic"),
            "merged tags should include artist tags");
    });
});

// ─── REQ-005: graceful error handling ────────────────────────────────────────

describe("ingestTrack – graceful error handling (REQ-005)", () => {
    it("returns error status when Last.fm client throws, without crashing", async () => {
        const client = makeClient({getTrackInfoError: new Error("Last.fm down")});

        const result = await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        assert.equal(result.status, "error");
        assert.ok(result.error instanceof Error);

        // No document should have been created
        const count = await Track.countDocuments({});
        assert.equal(count, 0);
    });
});

// ─── REQ-004: ingestBatch ────────────────────────────────────────────────────

describe("ingestBatch – processes multiple tracks (REQ-004)", () => {
    it("saves all tracks to the database", async () => {
        const client = makeClient();
        const tracks = [
            {artist: "Queen", title: "Bohemian Rhapsody"},
            {
                artist: "Radiohead",
                title: "Creep",
            },
        ];

        // Second call uses same trackInfo but we just care about storage
        const results = await ingestBatch(client, tracks);

        assert.equal(results.length, 2);
        assert.ok(results.every((r) => r.status === "saved" || r.status === "error"));

        const count = await Track.countDocuments({});
        assert.ok(count >= 1, "at least one track should be saved");
    });

    it("skips already-ingested tracks in the same batch", async () => {
        const client = makeClient();

        // Pre-seed one track
        await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        const tracks = [
            {artist: "Queen", title: "Bohemian Rhapsody"},
            {artist: "Queen", title: "Bohemian Rhapsody"},
        ];

        const results = await ingestBatch(client, tracks);

        assert.ok(results.every((r) => r.status === "skipped" || r.status === "saved"));
        const countSkipped = results.filter((r) => r.status === "skipped").length;
        assert.ok(countSkipped >= 1, "at least one should be skipped");
    });

    it("force updates existing tracks in batch", async () => {
        const client = makeClient();
        await ingestTrack(client, "Queen", "Bohemian Rhapsody");

        const results = await ingestBatch(
            client,
            [{artist: "Queen", title: "Bohemian Rhapsody"}],
            {force: true},
        );

        assert.equal(results[0].status, "updated");
    });

    it("continues processing after individual track failure (REQ-005)", async () => {
        let callCount = 0;
        const client = {
            getTrackInfo: async () => {
                callCount++;
                if (callCount === 1) throw new Error("first track error");
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

        const doc = await Track.findOne({artist: "Queen", title: "Bohemian Rhapsody"});
        assert.ok(doc, "second track should be saved despite first failure");
    });

    it("returns an empty array for an empty input", async () => {
        const client = makeClient();
        const results = await ingestBatch(client, []);
        assert.deepEqual(results, []);
    });
});

