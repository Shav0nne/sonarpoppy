import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GENRES,
  GENRE_COUNT,
  GENRE_INDEX,
  GENRE_ALIASES,
  resolveAlias,
  genreNameToIndex,
  genreIndexToName,
} from "../../src/config/genres.js";

// REQ-001: 20 gestandaardiseerde genres
describe("GENRES", () => {
  it("bevat exact 20 genres", () => {
    assert.equal(GENRES.length, 20);
  });

  it("GENRE_COUNT is 20", () => {
    assert.equal(GENRE_COUNT, 20);
  });

  it("bevat alleen unieke genres", () => {
    const unique = new Set(GENRES);
    assert.equal(unique.size, GENRES.length);
  });

  it("elke genre heeft een index in GENRE_INDEX", () => {
    for (const genre of GENRES) {
      assert.equal(typeof GENRE_INDEX[genre], "number");
    }
  });

  it("GENRE_INDEX indices matchen array posities", () => {
    for (let i = 0; i < GENRES.length; i++) {
      assert.equal(GENRE_INDEX[GENRES[i]], i);
    }
  });

  it("GENRES is frozen", () => {
    assert.ok(Object.isFrozen(GENRES));
  });
});

// REQ-002: Alias mapping
describe("resolveAlias", () => {
  it("resolved standaard genre namen naar zichzelf", () => {
    assert.equal(resolveAlias("rock"), "rock");
    assert.equal(resolveAlias("jazz"), "jazz");
  });

  it("resolved case-insensitive", () => {
    assert.equal(resolveAlias("Rock"), "rock");
    assert.equal(resolveAlias("JAZZ"), "jazz");
    assert.equal(resolveAlias("Hip-Hop"), "hip-hop");
  });

  it("resolved variaties van hip-hop", () => {
    assert.equal(resolveAlias("hip hop"), "hip-hop");
    assert.equal(resolveAlias("hiphop"), "hip-hop");
    assert.equal(resolveAlias("Hip-Hop"), "hip-hop");
    assert.equal(resolveAlias("rap"), "hip-hop");
  });

  it("resolved variaties van r&b", () => {
    assert.equal(resolveAlias("r&b"), "r&b");
    assert.equal(resolveAlias("rnb"), "r&b");
    assert.equal(resolveAlias("R And B"), "r&b");
  });

  it("resolved subgenres naar hoofdgenre", () => {
    assert.equal(resolveAlias("techno"), "electronic");
    assert.equal(resolveAlias("death metal"), "metal");
    assert.equal(resolveAlias("bebop"), "jazz");
  });

  it("retourneert null voor onbekende tags", () => {
    assert.equal(resolveAlias("onzintag"), null);
    assert.equal(resolveAlias("xyzgenre"), null);
  });

  it("retourneert null voor null/undefined/non-string", () => {
    assert.equal(resolveAlias(null), null);
    assert.equal(resolveAlias(undefined), null);
    assert.equal(resolveAlias(42), null);
  });

  it("trimt whitespace", () => {
    assert.equal(resolveAlias("  rock  "), "rock");
    assert.equal(resolveAlias(" jazz "), "jazz");
  });
});

// REQ-006: Index/naam conversie
describe("genreNameToIndex", () => {
  it("converteert bekende genre naam naar index", () => {
    assert.equal(genreNameToIndex("rock"), 0);
    assert.equal(genreNameToIndex("pop"), 1);
    assert.equal(genreNameToIndex("world"), 19);
  });

  it("is case-insensitive", () => {
    assert.equal(genreNameToIndex("Rock"), 0);
    assert.equal(genreNameToIndex("JAZZ"), 5);
  });

  it("retourneert null voor onbekend genre", () => {
    assert.equal(genreNameToIndex("onbekend"), null);
  });

  it("retourneert null voor null/undefined/non-string", () => {
    assert.equal(genreNameToIndex(null), null);
    assert.equal(genreNameToIndex(undefined), null);
    assert.equal(genreNameToIndex(123), null);
  });
});

describe("genreIndexToName", () => {
  it("converteert index naar genre naam", () => {
    assert.equal(genreIndexToName(0), "rock");
    assert.equal(genreIndexToName(1), "pop");
    assert.equal(genreIndexToName(19), "world");
  });

  it("retourneert null voor ongeldige index", () => {
    assert.equal(genreIndexToName(-1), null);
    assert.equal(genreIndexToName(20), null);
    assert.equal(genreIndexToName(999), null);
  });

  it("retourneert null voor non-number", () => {
    assert.equal(genreIndexToName("rock"), null);
    assert.equal(genreIndexToName(null), null);
  });
});
