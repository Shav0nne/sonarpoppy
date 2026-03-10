import { describe, it } from "node:test";
import assert from "node:assert";
import { isGenreBlocked } from "../../src/services/blacklist/blacklistFilter.js";
import { GENRE_COUNT, genreNameToIndex } from "../../src/config/genres.js";

function createVector(configs) {
    const vector = new Array(GENRE_COUNT).fill(0);
    for (const [genreName, val] of Object.entries(configs)) {
        const idx = genreNameToIndex(genreName);
        if (idx !== null) vector[idx] = val;
    }
    return vector;
}

describe("Blacklist Filter - isGenreBlocked", () => {
    it("should return false if empty blocked genres or empty vector", () => {
        assert.strictEqual(isGenreBlocked([0.1], []), false);
        assert.strictEqual(isGenreBlocked([], ["rock"]), false);
        assert.strictEqual(isGenreBlocked(null, ["rock"]), false);
    });

    it("should block if dominant genre is in blocked list", () => {
        // rock is dominant (0.8)
        const vector = createVector({ rock: 0.8, pop: 0.3 });
        assert.strictEqual(isGenreBlocked(vector, ["rock"]), true);
        assert.strictEqual(isGenreBlocked(vector, ["pop"]), false);
    });

    it("should block if a blocked genre is >= 0.4 threshold", () => {
        // pop is dominant (0.9), rock is secondary but passes threshold (0.5)
        const vector = createVector({ pop: 0.9, rock: 0.5 });

        assert.strictEqual(isGenreBlocked(vector, ["rock"]), true);
        assert.strictEqual(isGenreBlocked(vector, ["pop"]), true);
    });

    it("should not block if a blocked genre is < 0.4 and not dominant", () => {
        // pop is dominant (0.9), rock is secondary but below threshold (0.3)
        const vector = createVector({ pop: 0.9, rock: 0.3 });

        assert.strictEqual(isGenreBlocked(vector, ["rock"]), false);
        assert.strictEqual(isGenreBlocked(vector, ["pop"]), true);
    });

    it("should block if dominant genre is < 0.4 but in blocked list", () => {
        // all scores are low, but rock is still the dominant one
        const vector = createVector({ rock: 0.2, pop: 0.1 });
        assert.strictEqual(isGenreBlocked(vector, ["rock"]), true);
        assert.strictEqual(isGenreBlocked(vector, ["pop"]), false);
    });
});
