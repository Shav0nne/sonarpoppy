import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evolveProfileWeights } from "../../src/services/feedback/profileEvolution.js";

// Helper: genre vector met 1.0 op index, 0.0 elders
const v = (primary) => {
  const vec = new Array(20).fill(0);
  vec[primary] = 1;
  return vec;
};

// Helper: equal weights
const equalWeights = () => {
  const w = {};
  for (let i = 0; i < 20; i++) w[String(i)] = 1.0;
  return w;
};

describe("evolveProfileWeights", () => {
  it("liked track boosted het genre weight", () => {
    const weights = equalWeights();
    const feedbackItems = [{ action: "like", trackId: "t1" }];
    const tracks = [{ _id: "t1", genreVector: v(5) }]; // jazz (index 5)

    const evolved = evolveProfileWeights(weights, feedbackItems, tracks);

    // Jazz weight zou hoger moeten zijn dan de rest
    assert.ok(evolved["5"] > weights["5"], "jazz weight should increase");
  });

  it("disliked track verlaagt het genre weight", () => {
    const weights = equalWeights();
    const feedbackItems = [{ action: "dislike", trackId: "t1" }];
    const tracks = [{ _id: "t1", genreVector: v(0) }]; // rock (index 0)

    const evolved = evolveProfileWeights(weights, feedbackItems, tracks);

    assert.ok(evolved["0"] < weights["0"], "rock weight should decrease");
  });

  it("library track boosted sterker dan like", () => {
    const weights = equalWeights();
    const likeResult = evolveProfileWeights(
      weights,
      [{ action: "like", trackId: "t1" }],
      [{ _id: "t1", genreVector: v(5) }],
    );
    const libraryResult = evolveProfileWeights(
      weights,
      [{ action: "library", trackId: "t1" }],
      [{ _id: "t1", genreVector: v(5) }],
    );

    assert.ok(libraryResult["5"] > likeResult["5"], "library should boost more than like");
  });

  it("skip verlaagt minder dan dislike", () => {
    const weights = equalWeights();
    const skipResult = evolveProfileWeights(
      weights,
      [{ action: "skip", trackId: "t1" }],
      [{ _id: "t1", genreVector: v(0) }],
    );
    const dislikeResult = evolveProfileWeights(
      weights,
      [{ action: "dislike", trackId: "t1" }],
      [{ _id: "t1", genreVector: v(0) }],
    );

    assert.ok(skipResult["0"] > dislikeResult["0"], "skip should decrease less than dislike");
  });

  it("null action verandert weights niet", () => {
    const weights = equalWeights();
    const evolved = evolveProfileWeights(
      weights,
      [{ action: null, trackId: "t1" }],
      [{ _id: "t1", genreVector: v(0) }],
    );

    assert.deepEqual(evolved, weights);
  });

  it("lege feedbackItems retourneert originele weights", () => {
    const weights = equalWeights();
    const evolved = evolveProfileWeights(weights, [], []);
    assert.deepEqual(evolved, weights);
  });

  it("meerdere likes verschuiven profiel richting die genres", () => {
    const weights = equalWeights();
    const feedbackItems = [
      { action: "like", trackId: "t1" },
      { action: "like", trackId: "t2" },
    ];
    const tracks = [
      { _id: "t1", genreVector: v(5) }, // jazz
      { _id: "t2", genreVector: v(5) }, // jazz again
    ];

    const evolved = evolveProfileWeights(weights, feedbackItems, tracks);
    assert.ok(evolved["5"] > weights["5"], "jazz weight should increase significantly");
  });

  it("muteert originele weights object niet", () => {
    const weights = equalWeights();
    const original = { ...weights };
    evolveProfileWeights(
      weights,
      [{ action: "like", trackId: "t1" }],
      [{ _id: "t1", genreVector: v(5) }],
    );
    assert.deepEqual(weights, original);
  });

  it("feedback voor onbekende trackId wordt genegeerd", () => {
    const weights = equalWeights();
    const evolved = evolveProfileWeights(
      weights,
      [{ action: "like", trackId: "unknown" }],
      [{ _id: "t1", genreVector: v(5) }],
    );
    assert.deepEqual(evolved, weights);
  });

  // REQ-005: Locked genres worden overgeslagen bij profiel evolutie
  it("locked genres worden niet aangepast", () => {
    const weights = equalWeights();
    const feedbackItems = [{ action: "like", trackId: "t1" }];
    const tracks = [{ _id: "t1", genreVector: v(5) }]; // jazz (index 5)
    const locked = [5]; // lock jazz

    const evolved = evolveProfileWeights(weights, feedbackItems, tracks, locked);

    // Jazz (index 5) zou NIET gewijzigd moeten zijn
    assert.equal(evolved["5"], weights["5"], "locked genre should not change");
  });

  it("unlocked genres evolueren normaal naast locked genres", () => {
    const weights = equalWeights();
    // Track met multi-genre: jazz (5) EN rock (0)
    const vec = new Array(20).fill(0);
    vec[5] = 1; // jazz
    vec[0] = 0.8; // rock
    const feedbackItems = [{ action: "like", trackId: "t1" }];
    const tracks = [{ _id: "t1", genreVector: vec }];
    const locked = [5]; // lock jazz only

    const evolved = evolveProfileWeights(weights, feedbackItems, tracks, locked);

    // Jazz locked → niet aangepast
    assert.equal(evolved["5"], weights["5"], "locked jazz should not change");
    // Rock unlocked → wel aangepast
    assert.ok(evolved["0"] > weights["0"], "unlocked rock should increase");
  });

  it("lege locked array laat alle genres evolueren", () => {
    const weights = equalWeights();
    const feedbackItems = [{ action: "like", trackId: "t1" }];
    const tracks = [{ _id: "t1", genreVector: v(5) }];

    const withLocked = evolveProfileWeights(weights, feedbackItems, tracks, []);
    const withoutLocked = evolveProfileWeights(weights, feedbackItems, tracks);

    assert.deepEqual(withLocked, withoutLocked);
  });
});
