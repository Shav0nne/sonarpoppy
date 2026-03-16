import { describe, it } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import Blacklist from "../../src/models/Blacklist.js";

describe("Blacklist Model", () => {
    it("should validate a valid blacklist document", () => {
        const doc = new Blacklist({
            userId: "user-123",
            entries: [
                { type: "track", value: "track-123" },
                { type: "artist", value: "artist-name" },
                { type: "genre", value: "rock" },
            ],
        });
        const error = doc.validateSync();
        assert.strictEqual(error, undefined);
    });

    it("should fail validation if userId is missing", () => {
        const doc = new Blacklist({ entries: [] });
        const error = doc.validateSync();
        assert.ok(error.errors["userId"]);
    });

    it("should fail validation if entry type is invalid", () => {
        const doc = new Blacklist({
            userId: "user-123",
            entries: [{ type: "invalid_type", value: "val" }],
        });
        const error = doc.validateSync();
        assert.ok(error.errors["entries.0.type"]);
    });

    it("should fail validation if genre value is invalid", () => {
        const doc = new Blacklist({
            userId: "user-123",
            entries: [{ type: "genre", value: "not-a-real-genre" }],
        });
        const error = doc.validateSync();
        assert.ok(error.errors["entries.0.value"]);
        assert.match(error.errors["entries.0.value"].message, /not-a-real-genre is not a valid genre/);
    });
});
