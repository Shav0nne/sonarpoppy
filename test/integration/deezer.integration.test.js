import test, {mock} from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import {MongoMemoryServer} from "mongodb-memory-server";
import Track from "../../src/models/Track.js";
import {enrichTracksWithDeezer} from "../../src/services/deezer/enrichDeezer.js";

test("Deezer Enrichment Integration", async (t) => {
    let mongoServer;

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    t.after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    await t.test("should enrich tracks sequentially from db saving previewUrl", async () => {
        // 1. Seed
        const track = await Track.create({
            artist: "Daft Punk",
            title: "Get Lucky",
            genreVector: Array(20).fill(0.1),
        });

        // 2. Mock global fetch
        const originalFetch = global.fetch;
        global.fetch = mock.fn(async (url) => {
            const urlStr = url.toString();
            // Assert search query contains artist/title
            if (urlStr.includes("deezer.com/search")) {
                // Basic check
                return {
                    ok: true,
                    json: async () => ({
                        data: [
                            {
                                id: 12345,
                                title: "Get Lucky",
                                artist: {name: "Daft Punk"},
                                preview: "https://cdns-preview-d.dzcdn.net/stream/get-lucky.mp3"
                            }
                        ]
                    })
                };
            }
            return {ok: false, statusText: "Not Found"};
        });

        try {
            // 3. Run enrichment
            const result = await enrichTracksWithDeezer({batchSize: 1});

            // 4. Assertions
            assert.strictEqual(result.enriched, 1);

            const enrichedTrack = await Track.findById(track._id);
            assert.strictEqual(enrichedTrack.previewUrl, "https://cdns-preview-d.dzcdn.net/stream/get-lucky.mp3");
        } finally {
            // Restore fetch
            global.fetch = originalFetch;
        }
    });
});

