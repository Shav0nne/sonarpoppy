import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTokenBucket } from "../../src/services/lastfm/rateLimiter.js";

describe("createTokenBucket", () => {
  it("returns an object with acquire method", () => {
    const bucket = createTokenBucket({ capacity: 5, refillRate: 5 });
    assert.equal(typeof bucket.acquire, "function");
  });

  it("allows burst up to capacity without waiting", async () => {
    const bucket = createTokenBucket({ capacity: 5, refillRate: 5 });
    const start = Date.now();

    for (let i = 0; i < 5; i++) {
      await bucket.acquire();
    }

    const elapsed = Date.now() - start;
    assert.ok(elapsed < 50, `Burst should be instant, took ${elapsed}ms`);
  });

  it("waits when bucket is empty", async () => {
    const bucket = createTokenBucket({ capacity: 2, refillRate: 10 });

    // Drain bucket
    await bucket.acquire();
    await bucket.acquire();

    // Next acquire should wait ~100ms (1/10 per second = 100ms per token)
    const start = Date.now();
    await bucket.acquire();
    const elapsed = Date.now() - start;

    assert.ok(elapsed >= 80, `Should wait for refill, waited ${elapsed}ms`);
    assert.ok(elapsed < 200, `Should not wait too long, waited ${elapsed}ms`);
  });

  it("refills tokens over time", async () => {
    const bucket = createTokenBucket({ capacity: 2, refillRate: 20 });

    // Drain bucket
    await bucket.acquire();
    await bucket.acquire();

    // Wait for refill (50ms per token at rate 20/s)
    await new Promise((r) => setTimeout(r, 120));

    // Should be able to acquire again without long wait
    const start = Date.now();
    await bucket.acquire();
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 30, `Should have refilled, waited ${elapsed}ms`);
  });

  it("does not exceed capacity when idle", async () => {
    const bucket = createTokenBucket({ capacity: 3, refillRate: 100 });

    // Wait long enough for many tokens to theoretically accumulate
    await new Promise((r) => setTimeout(r, 100));

    // Should only allow capacity (3) bursts
    const start = Date.now();
    for (let i = 0; i < 3; i++) {
      await bucket.acquire();
    }
    const burstElapsed = Date.now() - start;
    assert.ok(burstElapsed < 30, `Burst of 3 should be instant`);

    // 4th should wait
    const waitStart = Date.now();
    await bucket.acquire();
    const waitElapsed = Date.now() - waitStart;
    assert.ok(waitElapsed >= 5, `4th should wait for refill`);
  });
});
