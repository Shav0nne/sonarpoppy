import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateApiKey,
  hashApiKey,
  compareApiKey,
} from "../../src/services/apikeys/generateKey.js";

describe("generateApiKey", () => {
  it("retourneert object met key en prefix", () => {
    const result = generateApiKey();
    assert.ok(result.key);
    assert.ok(result.prefix);
  });

  it("key begint met sk_live_", () => {
    const { key } = generateApiKey();
    assert.ok(key.startsWith("sk_live_"), `key should start with sk_live_, got: ${key}`);
  });

  it("key is sk_live_ + 32 hex chars (40 chars totaal)", () => {
    const { key } = generateApiKey();
    assert.equal(key.length, 8 + 32); // "sk_live_" = 8 chars
    const hex = key.slice(8);
    assert.match(hex, /^[0-9a-f]{32}$/);
  });

  it("prefix is eerste 16 chars van de key", () => {
    const { key, prefix } = generateApiKey();
    assert.equal(prefix, key.slice(0, 16));
  });

  it("genereert unieke keys", () => {
    const keys = new Set();
    for (let i = 0; i < 50; i++) {
      keys.add(generateApiKey().key);
    }
    assert.equal(keys.size, 50);
  });
});

describe("hashApiKey + compareApiKey", () => {
  it("hash is niet gelijk aan originele key", async () => {
    const { key } = generateApiKey();
    const hash = await hashApiKey(key);
    assert.notEqual(hash, key);
  });

  it("compareApiKey retourneert true voor correcte key", async () => {
    const { key } = generateApiKey();
    const hash = await hashApiKey(key);
    const match = await compareApiKey(key, hash);
    assert.equal(match, true);
  });

  it("compareApiKey retourneert false voor verkeerde key", async () => {
    const { key } = generateApiKey();
    const hash = await hashApiKey(key);
    const match = await compareApiKey("sk_live_wrongwrongwrongwrongwrong00", hash);
    assert.equal(match, false);
  });
});
