import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  validateApiKey,
  injectUserId,
  validateUserParam,
} from "../../src/middleware/apiKeyMiddleware.js";
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
  // Simuleert authenticateJWT — zet req.user.id vanuit x-test-user-id header
  const fakeJWT = (req, res, next) => {
    req.user = { id: req.headers["x-test-user-id"], role: "user" };
    next();
  };
  // Routes for injectUserId tests (body injection)
  app.post("/inject", validateApiKey, fakeJWT, injectUserId, (req, res) => {
    res.json({ userId: req.body.userId });
  });
  // Routes for validateUserParam tests (param validation via router.param)
  const paramRouter = express.Router();
  paramRouter.param("userId", validateUserParam);
  paramRouter.get("/:userId", (req, res) => {
    res.json({ userId: req.params.userId });
  });
  app.use("/param", validateApiKey, fakeJWT, paramRouter);
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

describe("injectUserId middleware", () => {
  it("overschrijft body.userId met JWT user id", async () => {
    const jwtUserId = new mongoose.Types.ObjectId().toString();
    const { key, prefix } = generateApiKey();
    const keyHash = await hashApiKey(key);
    await ApiKey.create({
      userId: new mongoose.Types.ObjectId(),
      name: "inject-test",
      prefix,
      keyHash,
      active: true,
    });

    const res = await fetch(`${baseUrl}/inject`, {
      method: "POST",
      headers: {
        "X-API-Key": key,
        "X-Test-User-Id": jwtUserId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: "attacker-id" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.userId, jwtUserId);
  });

  it("injecteert userId als body leeg is", async () => {
    const jwtUserId = new mongoose.Types.ObjectId().toString();
    const { key, prefix } = generateApiKey();
    const keyHash = await hashApiKey(key);
    await ApiKey.create({
      userId: new mongoose.Types.ObjectId(),
      name: "inject-empty",
      prefix,
      keyHash,
      active: true,
    });

    const res = await fetch(`${baseUrl}/inject`, {
      method: "POST",
      headers: {
        "X-API-Key": key,
        "X-Test-User-Id": jwtUserId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.userId, jwtUserId);
  });
});

describe("validateUserParam middleware", () => {
  it("200 als :userId param matcht met JWT user", async () => {
    const jwtUserId = new mongoose.Types.ObjectId().toString();
    const { key, prefix } = generateApiKey();
    const keyHash = await hashApiKey(key);
    await ApiKey.create({
      userId: new mongoose.Types.ObjectId(),
      name: "param-match",
      prefix,
      keyHash,
      active: true,
    });

    const res = await fetch(`${baseUrl}/param/${jwtUserId}`, {
      headers: { "X-API-Key": key, "X-Test-User-Id": jwtUserId },
    });
    assert.equal(res.status, 200);
  });

  it("403 als :userId param niet matcht met JWT user", async () => {
    const jwtUserId = new mongoose.Types.ObjectId().toString();
    const otherId = new mongoose.Types.ObjectId().toString();
    const { key, prefix } = generateApiKey();
    const keyHash = await hashApiKey(key);
    await ApiKey.create({
      userId: new mongoose.Types.ObjectId(),
      name: "param-mismatch",
      prefix,
      keyHash,
      active: true,
    });

    const res = await fetch(`${baseUrl}/param/${otherId}`, {
      headers: { "X-API-Key": key, "X-Test-User-Id": jwtUserId },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.message.includes("does not match"));
  });
});
