import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LastfmApiError,
  LastfmRateLimitError,
  LastfmNotFoundError,
} from "../../src/services/lastfm/errors.js";

describe("LastfmApiError", () => {
  it("extends Error", () => {
    const err = new LastfmApiError("test");
    assert.ok(err instanceof Error);
    assert.ok(err instanceof LastfmApiError);
  });

  it("sets message and statusCode", () => {
    const err = new LastfmApiError("bad request", 400);
    assert.equal(err.message, "bad request");
    assert.equal(err.statusCode, 400);
    assert.equal(err.name, "LastfmApiError");
  });

  it("defaults statusCode to null", () => {
    const err = new LastfmApiError("unknown");
    assert.equal(err.statusCode, null);
  });
});

describe("LastfmRateLimitError", () => {
  it("extends LastfmApiError", () => {
    const err = new LastfmRateLimitError();
    assert.ok(err instanceof LastfmApiError);
    assert.ok(err instanceof Error);
  });

  it("has statusCode 429 and default message", () => {
    const err = new LastfmRateLimitError();
    assert.equal(err.statusCode, 429);
    assert.equal(err.message, "Rate limit exceeded");
    assert.equal(err.name, "LastfmRateLimitError");
  });

  it("accepts custom message", () => {
    const err = new LastfmRateLimitError("too fast");
    assert.equal(err.message, "too fast");
  });
});

describe("LastfmNotFoundError", () => {
  it("extends LastfmApiError", () => {
    const err = new LastfmNotFoundError();
    assert.ok(err instanceof LastfmApiError);
    assert.ok(err instanceof Error);
  });

  it("has statusCode 404 and default message", () => {
    const err = new LastfmNotFoundError();
    assert.equal(err.statusCode, 404);
    assert.equal(err.message, "Resource not found");
    assert.equal(err.name, "LastfmNotFoundError");
  });
});
