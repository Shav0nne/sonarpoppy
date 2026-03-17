import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import sliderPresetsRouter from "../../routes/slider-presets.js";
import SliderPreset from "../../src/models/SliderPreset.js";
import GenreSliders from "../../src/models/GenreSliders.js";

let mongod, server, baseUrl;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());

  // Test middleware: mimic authenticateJWT + onboarding
  app.use((req, _res, next) => {
    const userId = req.headers["x-user-id"];
    if (userId) req.user = { id: userId, hasCompletedOnboarding: true };
    next();
  });

  app.use("/api/slider-presets", sliderPresetsRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

beforeEach(async () => {
  await SliderPreset.deleteMany({});
  await GenreSliders.deleteMany({});
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongod.stop();
});

const userId = "test-user-1";
const headers = { "X-User-Id": userId, "Content-Type": "application/json" };

// REQ-002: GET /api/slider-presets
describe("GET /api/slider-presets", () => {
  it("seeded 3 default presets bij eerste call voor nieuwe user", async () => {
    const res = await fetch(`${baseUrl}/api/slider-presets`, { headers });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.length, 3);

    const names = body.map((p) => p.name).sort();
    assert.deepEqual(names, ["Balanced", "Chill Vibes", "High Energy"]);
    assert.ok(body.every((p) => p.isDefault === true));
    assert.ok(body.every((p) => p.userId === userId));
  });

  it("retourneert bestaande presets zonder re-seeding", async () => {
    // Seed first
    await fetch(`${baseUrl}/api/slider-presets`, { headers });
    // Second call
    const res = await fetch(`${baseUrl}/api/slider-presets`, { headers });
    const body = await res.json();
    assert.equal(body.length, 3);
  });

  it("retourneert user-created presets samen met defaults", async () => {
    // Seed defaults
    await fetch(`${baseUrl}/api/slider-presets`, { headers });
    // Create custom
    await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Custom", sliders: { rock: 0.8 } }),
    });

    const res = await fetch(`${baseUrl}/api/slider-presets`, { headers });
    const body = await res.json();
    assert.equal(body.length, 4);
  });
});

// REQ-001: POST /api/slider-presets
describe("POST /api/slider-presets", () => {
  it("maakt een nieuwe preset aan met 201", async () => {
    const res = await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "My Preset",
        sliders: { rock: 1.0, pop: 0.5 },
        locked: ["rock"],
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.name, "My Preset");
    assert.equal(body.sliders.rock, 1.0);
    assert.equal(body.sliders.pop, 0.5);
    assert.deepEqual(body.locked, ["rock"]);
    assert.equal(body.userId, userId);
    assert.equal(body.isDefault, false);
  });

  it("retourneert 400 bij ontbrekende naam", async () => {
    const res = await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ sliders: { rock: 1.0 } }),
    });
    assert.equal(res.status, 400);
  });

  it("retourneert 400 bij lege naam", async () => {
    const res = await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "  ", sliders: { rock: 1.0 } }),
    });
    assert.equal(res.status, 400);
  });

  it("retourneert 409 bij dubbele naam", async () => {
    await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Unique", sliders: { rock: 1.0 } }),
    });

    const res = await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Unique", sliders: { pop: 0.5 } }),
    });
    assert.equal(res.status, 409);
  });

  it("retourneert 400 bij max 5 presets bereikt", async () => {
    // Create 5 presets
    for (let i = 1; i <= 5; i++) {
      await fetch(`${baseUrl}/api/slider-presets`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: `Preset ${i}`, sliders: { rock: 1.0 } }),
      });
    }

    const res = await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Preset 6", sliders: { rock: 1.0 } }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes("5"));
  });

  it("telt defaults mee voor het max 5 limiet", async () => {
    // Seed 3 defaults
    await fetch(`${baseUrl}/api/slider-presets`, { headers });
    // Create 2 custom
    for (let i = 1; i <= 2; i++) {
      const r = await fetch(`${baseUrl}/api/slider-presets`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: `Custom ${i}`,
          sliders: { rock: 1.0 },
        }),
      });
      assert.equal(r.status, 201);
    }

    // 6th should fail
    const res = await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Too Many", sliders: { rock: 1.0 } }),
    });
    assert.equal(res.status, 400);
  });
});

// REQ-003: PATCH /api/slider-presets/:presetId
describe("PATCH /api/slider-presets/:presetId", () => {
  it("update preset naam", async () => {
    const createRes = await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Old Name", sliders: { rock: 1.0 } }),
    });
    const { _id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/slider-presets/${_id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "New Name" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.name, "New Name");
  });

  it("update preset sliders", async () => {
    const createRes = await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Update Sliders", sliders: { rock: 1.0 } }),
    });
    const { _id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/slider-presets/${_id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sliders: { rock: 0.5, pop: 0.8 } }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.sliders.rock, 0.5);
    assert.equal(body.sliders.pop, 0.8);
  });

  it("retourneert 404 voor onbekend preset", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await fetch(`${baseUrl}/api/slider-presets/${fakeId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "Nope" }),
    });
    assert.equal(res.status, 404);
  });

  it("retourneert 409 bij naam conflict", async () => {
    await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Taken", sliders: { rock: 1.0 } }),
    });
    const createRes = await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Other", sliders: { pop: 0.5 } }),
    });
    const { _id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/slider-presets/${_id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "Taken" }),
    });
    assert.equal(res.status, 409);
  });
});

// REQ-004: DELETE /api/slider-presets/:presetId
describe("DELETE /api/slider-presets/:presetId", () => {
  it("verwijdert preset met 204", async () => {
    const createRes = await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "To Delete", sliders: { rock: 1.0 } }),
    });
    const { _id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/slider-presets/${_id}`, {
      method: "DELETE",
      headers,
    });
    assert.equal(res.status, 204);

    // Verify deleted
    const count = await SliderPreset.countDocuments({ userId });
    assert.equal(count, 0);
  });

  it("kan default presets verwijderen", async () => {
    // Seed defaults
    const listRes = await fetch(`${baseUrl}/api/slider-presets`, { headers });
    const presets = await listRes.json();
    const defaultPreset = presets.find((p) => p.isDefault);

    const res = await fetch(`${baseUrl}/api/slider-presets/${defaultPreset._id}`, {
      method: "DELETE",
      headers,
    });
    assert.equal(res.status, 204);
  });

  it("retourneert 404 voor onbekend preset", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await fetch(`${baseUrl}/api/slider-presets/${fakeId}`, {
      method: "DELETE",
      headers,
    });
    assert.equal(res.status, 404);
  });
});

// REQ-005: POST /api/slider-presets/:presetId/apply
describe("POST /api/slider-presets/:presetId/apply", () => {
  it("overschrijft GenreSliders volledig met preset data", async () => {
    // Create preset with specific sliders
    const createRes = await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Apply Test",
        sliders: { rock: 0.8, pop: 0.3, jazz: 0.9 },
        locked: ["jazz"],
      }),
    });
    const { _id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/slider-presets/${_id}/apply`, {
      method: "POST",
      headers,
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.sliders.rock, 0.8);
    assert.equal(body.sliders.pop, 0.3);
    assert.equal(body.sliders.jazz, 0.9);
    assert.deepEqual(body.locked, ["jazz"]);
    assert.ok(body.updatedAt);
  });

  it("overschrijft bestaande GenreSliders", async () => {
    // Create existing GenreSliders
    await GenreSliders.create({
      userId,
      sliders: { rock: 1.0, pop: 1.0 },
      locked: ["rock"],
    });

    // Create preset
    const createRes = await fetch(`${baseUrl}/api/slider-presets`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Overwrite Test",
        sliders: { electronic: 0.7 },
        locked: [],
      }),
    });
    const { _id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/slider-presets/${_id}/apply`, {
      method: "POST",
      headers,
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.sliders.electronic, 0.7);
    assert.deepEqual(body.locked, []);
  });

  it("retourneert 404 voor onbekend preset", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await fetch(`${baseUrl}/api/slider-presets/${fakeId}/apply`, {
      method: "POST",
      headers,
    });
    assert.equal(res.status, 404);
  });
});
