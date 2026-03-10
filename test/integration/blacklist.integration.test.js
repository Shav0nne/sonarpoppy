import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import http from "node:http";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";

import blacklistRouter from "../../routes/blacklist.js";
import Blacklist from "../../src/models/Blacklist.js";
import Track from "../../src/models/Track.js";
import { getRecommendations } from "../../src/services/recommendation/recommend.js";
import { GENRE_COUNT, genreNameToIndex } from "../../src/config/genres.js";

let mongoServer;
let server;
let baseUrl;

const userId = "integration-user-123";

function createVector(nameValPairs) {
    const v = new Array(GENRE_COUNT).fill(0);
    for (const [name, val] of Object.entries(nameValPairs)) {
        const idx = genreNameToIndex(name);
        if (idx !== null) v[idx] = val;
    }
    return v;
}

before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    const app = express();
    app.use(express.json());
    app.use("/api/blacklist", blacklistRouter);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
    server?.close();
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Blacklist.deleteMany({});
    await Track.deleteMany({});
});

describe("Blacklist Integration", () => {
    describe("API Endpoints", () => {
        it("POST /api/blacklist/:userId should add entry", async () => {
            const res = await fetch(`${baseUrl}/api/blacklist/${userId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "artist",
                    value: "Taylor Swift",
                }),
            });
            const data = await res.json();

            assert.strictEqual(res.status, 201);
            assert.strictEqual(data.entry.type, "artist");
            assert.strictEqual(data.entry.value, "Taylor Swift");

            const doc = await Blacklist.findOne({ userId });
            assert.strictEqual(doc.entries.length, 1);
        });

        it("POST /api/blacklist/:userId should reject duplicates", async () => {
            // First add
            await fetch(`${baseUrl}/api/blacklist/${userId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "genre", value: "rock" }),
            });

            // Duplicate add
            const res = await fetch(`${baseUrl}/api/blacklist/${userId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "genre", value: "rock" }),
            });
            const data = await res.json();

            assert.strictEqual(res.status, 409);
            assert.strictEqual(data.error, "Entry already exists in blacklist");
        });

        it("POST /api/blacklist/:userId should resolve genre aliases", async () => {
            const res = await fetch(`${baseUrl}/api/blacklist/${userId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "genre", value: "classic rock" }),
            });
            const data = await res.json();
            assert.strictEqual(res.status, 201);
            assert.strictEqual(data.entry.value, "rock");
        });

        it("GET /api/blacklist/:userId should return entries", async () => {
            await Blacklist.create({
                userId,
                entries: [{ type: "track", value: "t1" }],
            });

            const res = await fetch(`${baseUrl}/api/blacklist/${userId}`);
            const data = await res.json();

            assert.strictEqual(res.status, 200);
            assert.strictEqual(data.entries.length, 1);
            assert.strictEqual(data.entries[0].value, "t1");
        });

        it("DELETE /api/blacklist/:userId/:entryId should remove entry", async () => {
            const doc = await Blacklist.create({
                userId,
                entries: [{ type: "track", value: "t1" }, { type: "track", value: "t2" }],
            });

            const entryId = doc.entries[0]._id.toString();

            const res = await fetch(`${baseUrl}/api/blacklist/${userId}/${entryId}`, {
                method: "DELETE"
            });
            assert.strictEqual(res.status, 200);

            const updated = await Blacklist.findOne({ userId });
            assert.strictEqual(updated.entries.length, 1);
            assert.strictEqual(updated.entries[0].value, "t2");
        });
    });

    describe("Recommendation Pipeline Rules", () => {
        it("should filter out tracks and artists pre-score, and genres post-score", async () => {
            // Setup tracks
            const t1 = await Track.create({ title: "Banned Track", artist: "Cool Band", genreVector: createVector({ pop: 0.9 }) });
            const t2 = await Track.create({ title: "Good Track", artist: "Banned Artist", genreVector: createVector({ pop: 0.9 }) });
            const t3 = await Track.create({ title: "Bad Genre", artist: "Cool Band", genreVector: createVector({ rock: 0.9 }) });
            const t4 = await Track.create({ title: "Great Track", artist: "Cool Band", genreVector: createVector({ pop: 0.9 }) });

            // Setup blacklist
            await Blacklist.create({
                userId,
                entries: [
                    { type: "track", value: t1._id.toString() },
                    { type: "artist", value: "Banned Artist" },
                    { type: "genre", value: "rock" },
                ],
            });

            // User profile vector (likes pop and rock)
            const profileVector = createVector({ pop: 0.8, rock: 0.8 });

            const result = await getRecommendations({
                profileVector,
                userId,
            });

            assert.strictEqual(result.tracks.length, 1);
            assert.strictEqual(result.tracks[0].track._id.toString(), t4._id.toString());
            assert.strictEqual(result.tracks[0].track.title, "Great Track");
        });
    });
});
