import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import apiKeysRouter from "../../routes/api-keys.js";
import ApiKey from "../../src/models/ApiKey.js";

let mongod, server, baseUrl;
const JWT_SECRET = "test-secret";
const userId = new mongoose.Types.ObjectId().toString();

function makeToken(sub = userId) {
  return jwt.sign({ sub, role: "user" }, JWT_SECRET);
}

before(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());
  app.use("/api/v1/api-keys", apiKeysRouter);
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
  delete process.env.JWT_SECRET;
});

describe("POST /api/v1/api-keys", () => {
  it("401 zonder JWT", async () => {
    const res = await fetch(`${baseUrl}/api/v1/api-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });
    assert.equal(res.status, 401);
  });

  it("400 zonder name", async () => {
    const res = await fetch(`${baseUrl}/api/v1/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${makeToken()}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.message.includes("name"));
  });

  it("201 met geldige data — retourneert key eenmalig", async () => {
    const res = await fetch(`${baseUrl}/api/v1/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${makeToken()}`,
      },
      body: JSON.stringify({ name: "My App" }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.key.startsWith("sk_live_"));
    assert.ok(body.prefix);
    assert.ok(body.id);
    assert.equal(body.name, "My App");
    assert.equal(body.active, true);
  });

  // REQ-004: max 5 actieve keys
  it("409 bij 5 actieve keys", async () => {
    // Create 5 keys
    for (let i = 0; i < 5; i++) {
      await fetch(`${baseUrl}/api/v1/api-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${makeToken()}`,
        },
        body: JSON.stringify({ name: `Key ${i}` }),
      });
    }

    // 6th should fail
    const res = await fetch(`${baseUrl}/api/v1/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${makeToken()}`,
      },
      body: JSON.stringify({ name: "Key 6" }),
    });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.ok(body.message.includes("5"));
  });

  it("kan nieuwe key maken na revoke (onder limiet)", async () => {
    // Create 5 keys
    const ids = [];
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/api/v1/api-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${makeToken()}`,
        },
        body: JSON.stringify({ name: `Key ${i}` }),
      });
      const body = await res.json();
      ids.push(body.id);
    }

    // Revoke one
    await fetch(`${baseUrl}/api/v1/api-keys/${ids[0]}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${makeToken()}` },
    });

    // Now should succeed
    const res = await fetch(`${baseUrl}/api/v1/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${makeToken()}`,
      },
      body: JSON.stringify({ name: "Key After Revoke" }),
    });
    assert.equal(res.status, 201);
  });
});

describe("GET /api/v1/api-keys", () => {
  it("401 zonder JWT", async () => {
    const res = await fetch(`${baseUrl}/api/v1/api-keys`);
    assert.equal(res.status, 401);
  });

  it("retourneert lege lijst", async () => {
    const res = await fetch(`${baseUrl}/api/v1/api-keys`, {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.items, []);
  });

  it("retourneert keys zonder hash", async () => {
    await fetch(`${baseUrl}/api/v1/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${makeToken()}`,
      },
      body: JSON.stringify({ name: "Test" }),
    });

    const res = await fetch(`${baseUrl}/api/v1/api-keys`, {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    const body = await res.json();
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].name, "Test");
    assert.ok(body.items[0].prefix);
    assert.equal(body.items[0].keyHash, undefined);
    assert.equal(body.items[0].key, undefined);
  });
});

describe("DELETE /api/v1/api-keys/:id", () => {
  it("401 zonder JWT", async () => {
    const res = await fetch(`${baseUrl}/api/v1/api-keys/${new mongoose.Types.ObjectId()}`, {
      method: "DELETE",
    });
    assert.equal(res.status, 401);
  });

  it("404 voor niet-bestaande key", async () => {
    const res = await fetch(`${baseUrl}/api/v1/api-keys/${new mongoose.Types.ObjectId()}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 404);
  });

  it("zet active=false (soft delete)", async () => {
    const createRes = await fetch(`${baseUrl}/api/v1/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${makeToken()}`,
      },
      body: JSON.stringify({ name: "To Revoke" }),
    });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/v1/api-keys/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.active, false);
    assert.equal(body.id, id);
  });
});
