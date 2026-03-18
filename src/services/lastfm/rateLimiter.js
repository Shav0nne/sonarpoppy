export function createTokenBucket({ capacity, refillRate }) {
  let tokens = capacity;
  let lastRefill = Date.now();

  function refill() {
    const now = Date.now();
    const elapsed = (now - lastRefill) / 1000;
    tokens = Math.min(capacity, tokens + elapsed * refillRate);
    lastRefill = now;
  }

  async function acquire() {
    refill();

    if (tokens >= 1) {
      tokens -= 1;
      return;
    }

    const deficit = 1 - tokens;
    const waitMs = (deficit / refillRate) * 1000;
    await new Promise((r) => setTimeout(r, waitMs));

    refill();
    tokens -= 1;
  }

  return { acquire };
}
