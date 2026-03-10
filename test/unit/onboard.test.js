import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateOnboarding,
  calculateGenreWeights,
  applyArtistBoost,
} from "../../src/services/onboarding/onboard.js";
import { GENRES } from "../../src/config/genres.js";

describe("validateOnboarding", () => {
  const validBase = {
    userId: "user-1",
    genres: ["rock", "pop", "jazz"],
    artists: ["Radiohead", "Daft Punk", "Miles Davis"],
    app: "sonarpop",
  };

  it("accepteert valid SonarPop input (3 genres + 3 artiesten)", () => {
    assert.doesNotThrow(() => validateOnboarding(validBase));
  });

  it("SonarPop: rejecteert <3 genres", () => {
    assert.throws(() => validateOnboarding({ ...validBase, genres: ["rock", "pop"] }), {
      message: /at least 3 genres/i,
    });
  });

  it("SonarPop: rejecteert <3 artiesten", () => {
    assert.throws(
      () =>
        validateOnboarding({
          ...validBase,
          artists: ["Radiohead", "Daft Punk"],
        }),
      { message: /at least 3 artists/i },
    );
  });

  it("Poppy: accepteert 3 genres zonder artiesten", () => {
    assert.doesNotThrow(() =>
      validateOnboarding({
        ...validBase,
        app: "poppy",
        artists: [],
      }),
    );
  });

  it("Poppy: rejecteert <3 genres", () => {
    assert.throws(
      () =>
        validateOnboarding({
          ...validBase,
          app: "poppy",
          genres: ["rock"],
        }),
      { message: /at least 3 genres/i },
    );
  });

  it("rejecteert ongeldige genre namen", () => {
    assert.throws(
      () =>
        validateOnboarding({
          ...validBase,
          genres: ["rock", "pop", "niet-bestaand"],
        }),
      { message: /invalid genre/i },
    );
  });

  it("rejecteert onbekende app", () => {
    assert.throws(() => validateOnboarding({ ...validBase, app: "unknown" }), { message: /app/i });
  });

  it("rejecteert ontbrekende userId", () => {
    assert.throws(() => validateOnboarding({ ...validBase, userId: "" }), { message: /userId/i });
  });
});

describe("calculateGenreWeights", () => {
  it("gekozen genres krijgen weight 1.0", () => {
    const weights = calculateGenreWeights(["rock", "pop", "jazz"]);
    assert.equal(weights.rock, 1.0);
    assert.equal(weights.pop, 1.0);
    assert.equal(weights.jazz, 1.0);
  });

  it("niet-gekozen genres krijgen lagere weight (< 1.0)", () => {
    const weights = calculateGenreWeights(["rock", "pop", "jazz"]);
    for (const genre of GENRES) {
      if (["rock", "pop", "jazz"].includes(genre)) continue;
      assert.ok(weights[genre] < 1.0, `${genre} should be < 1.0, got ${weights[genre]}`);
    }
  });

  it("alle weights zijn binnen 0-1 range", () => {
    const weights = calculateGenreWeights(["rock", "pop", "jazz"]);
    for (const genre of GENRES) {
      assert.ok(weights[genre] >= 0, `${genre} should be >= 0`);
      assert.ok(weights[genre] <= 1.0, `${genre} should be <= 1.0`);
    }
  });

  it("retourneert weights voor alle 20 genres", () => {
    const weights = calculateGenreWeights(["rock"]);
    assert.equal(Object.keys(weights).length, GENRES.length);
  });
});

describe("applyArtistBoost", () => {
  // Mock lastfmClient die tags retourneert
  function mockClient(tagMap) {
    return {
      getArtistTopTags: async (artist) => tagMap[artist] || [],
    };
  }

  it("boost genre dat matched met artiest tags", async () => {
    const weights = calculateGenreWeights(["rock", "pop", "jazz"]);
    const client = mockClient({
      "Daft Punk": [
        { name: "electronic", count: 100 },
        { name: "dance", count: 80 },
      ],
    });
    const boosted = await applyArtistBoost(weights, ["Daft Punk"], client);
    assert.ok(
      boosted.electronic > weights.electronic,
      `electronic should be boosted: ${boosted.electronic} > ${weights.electronic}`,
    );
  });

  it("alle weights blijven binnen 0-1 range na boost", async () => {
    const weights = calculateGenreWeights(["rock"]);
    const client = mockClient({
      Artist1: [
        { name: "electronic", count: 100 },
        { name: "techno", count: 90 },
        { name: "house", count: 80 },
      ],
      Artist2: [
        { name: "electronic", count: 100 },
        { name: "ambient", count: 70 },
      ],
      Artist3: [{ name: "electronic", count: 100 }],
    });
    const boosted = await applyArtistBoost(weights, ["Artist1", "Artist2", "Artist3"], client);
    for (const genre of GENRES) {
      assert.ok(boosted[genre] >= 0, `${genre} >= 0`);
      assert.ok(boosted[genre] <= 1.0, `${genre} <= 1.0, got ${boosted[genre]}`);
    }
  });

  it("onbekende tags worden genegeerd", async () => {
    const weights = calculateGenreWeights(["rock", "pop", "jazz"]);
    const client = mockClient({
      "Unknown Artist": [
        { name: "completely-unknown-tag", count: 100 },
        { name: "another-weird-tag", count: 50 },
      ],
    });
    const boosted = await applyArtistBoost(weights, ["Unknown Artist"], client);
    // Weights moeten ongewijzigd zijn (geen bekende tags)
    assert.deepEqual(boosted, weights);
  });

  it("Last.fm fout per artiest stopt niet het hele proces", async () => {
    const weights = calculateGenreWeights(["rock", "pop", "jazz"]);
    const client = {
      getArtistTopTags: async (artist) => {
        if (artist === "Bad Artist") throw new Error("Not found");
        return [{ name: "electronic", count: 100 }];
      },
    };
    const boosted = await applyArtistBoost(weights, ["Bad Artist", "Good Artist"], client);
    assert.ok(boosted.electronic > weights.electronic, "Good Artist tags still applied");
  });

  it("lege artists array retourneert ongewijzigde weights", async () => {
    const weights = calculateGenreWeights(["rock", "pop", "jazz"]);
    const client = mockClient({});
    const boosted = await applyArtistBoost(weights, [], client);
    assert.deepEqual(boosted, weights);
  });
});
