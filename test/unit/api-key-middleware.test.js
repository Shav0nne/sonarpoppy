import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { validateApiKey } from "../../src/middleware/apiKeyMiddleware.js";
import ApiKey from "../../src/models/ApiKey.js";
import { generateApiKey, hashApiKey } from "../../src/services/apikeys/generateKey.js";

let mongod, server, baseUrl;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());
  // Protected route behind middleware
  app.get("/protected", validateApiKey, (req, res) => {
    res.json({ ok: true, apiKeyId: req.apiKey.id });
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

beforeEach(async () => {
  await ApiKey.deleteMany({});
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongod.stop();
});

describe("validateApiKey middleware", () => {
  it("401 zonder X-API-Key header", async () => {
    const res = await fetch(`${baseUrl}/protected`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.message);
  });

  it("401 met ongeldige key (geen match in DB)", async () => {
    const res = await fetch(`${baseUrl}/protected`, {
      headers: { "X-API-Key": "sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
    });
    assert.equal(res.status, 401);
  });

  it("401 met gerevokede key (active=false)", async () => {
    const { key, prefix } = generateApiKey();
    const keyHash = await hashApiKey(key);
    await ApiKey.create({
      userId: new mongoose.Types.ObjectId(),
      name: "revoked",
      prefix,
      keyHash,
      active: false,
    });

    const res = await fetch(`${baseUrl}/protected`, {
      headers: { "X-API-Key": key },
    });
    assert.equal(res.status, 401);
  });

  it("200 met geldige actieve key — req.apiKey populated", async () => {
    const { key, prefix } = generateApiKey();
    const keyHash = await hashApiKey(key);
    const doc = await ApiKey.create({
      userId: new mongoose.Types.ObjectId(),
      name: "valid",
      prefix,
      keyHash,
      active: true,
    });

    const res = await fetch(`${baseUrl}/protected`, {
      headers: { "X-API-Key": key },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.apiKeyId, doc._id.toString());
  });
});
