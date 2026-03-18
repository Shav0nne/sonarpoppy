import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import feedbackRouter from "../../routes/feedback.js";
import GenreSliders from "../../src/models/GenreSliders.js";
import Track from "../../src/models/Track.js";
import Feedback from "../../src/models/Feedback.js";
import { GENRES, GENRE_INDEX } from "../../src/config/genres.js";

const USER_ID = "evo-test-user";

/** Build a 20-dim genreVector from a name→value map */
function makeGenreVector(configs) {
  const vec = new Array(GENRES.length).fill(0);
  for (const [name, val] of Object.entries(configs)) {
    const idx = GENRE_INDEX[name];
    if (idx !== undefined) vec[idx] = val;
  }
  return vec;
}

let mongod, server, baseUrl;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await GenreSliders.syncIndexes();
  await Track.syncIndexes();
  await Feedback.syncIndexes();

  const app = express();
  app.use(express.json());

  // Auth stub — simuleert ingelogde user met onboarding voltooid
  app.use((req, res, next) => {
    req.user = { id: USER_ID, hasCompletedOnboarding: true };
    next();
  });

  app.use("/api/feedback", feedbackRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

beforeEach(async () => {
  await GenreSliders.deleteMany({});
  await Track.deleteMany({});
  await Feedback.deleteMany({});
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongod.stop();
});

const headers = { "Content-Type": "application/json" };

// Item 1: Like op track evolueert sliders omhoog
describe("Item 1: Like evolueert sliders omhoog", () => {
  it("rock slider stijgt na like op rock-track", async () => {
    // Setup: sliders rock=1.0, pop=0.5
    await GenreSliders.create({
      userId: USER_ID,
      sliders: { rock: 1.0, pop: 0.5 },
    });

    // Setup: track met genreVector rock=0.8, pop=0.2
    const track = await Track.create({
      title: "Rock Song",
      artist: "Rock Artist",
      genreVector: makeGenreVector({ rock: 0.8, pop: 0.2 }),
    });

    // POST feedback like
    const res = await fetch(`${baseUrl}/api/feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify({ trackId: track._id.toString(), action: "like" }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();

    // Check evolution in response
    assert.ok(body.evolution, "response moet evolution bevatten");
    assert.ok(body.evolution.changed.rock > 0, "rock delta moet positief zijn");

    // Verify sliders in DB
    const sliders = await GenreSliders.findOne({ userId: USER_ID }).lean();
    assert.ok(
      sliders.sliders.rock > 1.0,
      `rock slider moet hoger zijn dan 1.0, was ${sliders.sliders.rock}`,
    );
  });
});

// Item 2: Locked genres blijven ongewijzigd na feedback
describe("Item 2: Locked genres blijven ongewijzigd", () => {
  it("jazz slider blijft exact 0.8 als locked", async () => {
    await GenreSliders.create({
      userId: USER_ID,
      sliders: { rock: 1.0, jazz: 0.8, pop: 0.5 },
      locked: ["jazz"],
    });

    const track = await Track.create({
      title: "Mixed Track",
      artist: "Mixed Artist",
      genreVector: makeGenreVector({ rock: 0.6, jazz: 0.4, pop: 0.3 }),
    });

    const res = await fetch(`${baseUrl}/api/feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify({ trackId: track._id.toString(), action: "like" }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();

    // jazz locked check
    const sliders = await GenreSliders.findOne({ userId: USER_ID }).lean();
    assert.equal(sliders.sliders.jazz, 0.8, "jazz moet exact 0.8 blijven (locked)");

    // evolution checks
    assert.ok(body.evolution, "response moet evolution bevatten");
    assert.ok(body.evolution.locked.includes("jazz"), "evolution.locked moet jazz bevatten");
    assert.equal(
      body.evolution.changed.jazz,
      undefined,
      "evolution.changed mag geen jazz bevatten",
    );
  });
});

// Item 3: Weights worden niet negatief na dislike
describe("Item 3: Weights worden niet negatief na dislike", () => {
  it("rock slider clampt op 0.0 bij dislike", async () => {
    await GenreSliders.create({
      userId: USER_ID,
      sliders: { rock: 0.01 },
    });

    const track = await Track.create({
      title: "Heavy Rock",
      artist: "Heavy Artist",
      genreVector: makeGenreVector({ rock: 0.5 }),
    });

    const res = await fetch(`${baseUrl}/api/feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify({ trackId: track._id.toString(), action: "dislike" }),
    });
    assert.equal(res.status, 201);

    const sliders = await GenreSliders.findOne({ userId: USER_ID }).lean();
    assert.equal(sliders.sliders.rock, 0, "rock moet 0.0 zijn, niet negatief");
  });
});

// Item 4: Response bevat evolution object
describe("Item 4: Response bevat evolution object", () => {
  it("evolution.changed en evolution.locked aanwezig in response", async () => {
    await GenreSliders.create({
      userId: USER_ID,
      sliders: { rock: 1.0, pop: 0.5 },
    });

    const track = await Track.create({
      title: "Some Track",
      artist: "Some Artist",
      genreVector: makeGenreVector({ rock: 0.7, pop: 0.3 }),
    });

    const res = await fetch(`${baseUrl}/api/feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify({ trackId: track._id.toString(), action: "like" }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();

    assert.ok(body.evolution, "evolution moet aanwezig zijn");
    assert.ok(typeof body.evolution.changed === "object", "evolution.changed moet een object zijn");
    assert.ok(Array.isArray(body.evolution.locked), "evolution.locked moet een array zijn");
    // changed moet genre keys bevatten
    assert.ok(Object.keys(body.evolution.changed).length > 0, "changed moet genre keys bevatten");
  });
});

// Item 5: Evolutie zonder GenreSliders wordt overgeslagen
describe("Item 5: Evolutie zonder GenreSliders = null", () => {
  it("response bevat evolution: null als user geen GenreSliders heeft", async () => {
    const track = await Track.create({
      title: "Track Without Sliders",
      artist: "Artist",
      genreVector: makeGenreVector({ rock: 0.5 }),
    });

    // Geen GenreSliders aangemaakt voor USER_ID
    const res = await fetch(`${baseUrl}/api/feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify({ trackId: track._id.toString(), action: "like" }),
    });
    assert.equal(res.status, 201, "status moet 201 zijn, geen fout");
    const body = await res.json();
    assert.equal(body.evolution, null, "evolution moet null zijn zonder GenreSliders");
  });
});

// Item I1: Lock + dislike near zero (integratie REQ-002+003)
describe("Item I1: Lock + dislike near zero", () => {
  it("jazz locked bij 0.8, rock clamped naar 0.0 bij dislike", async () => {
    await GenreSliders.create({
      userId: USER_ID,
      sliders: { jazz: 0.8, rock: 0.02 },
      locked: ["jazz"],
    });

    const track = await Track.create({
      title: "Jazz Rock Mix",
      artist: "JR Artist",
      genreVector: makeGenreVector({ jazz: 0.5, rock: 0.4 }),
    });

    const res = await fetch(`${baseUrl}/api/feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify({ trackId: track._id.toString(), action: "dislike" }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();

    const sliders = await GenreSliders.findOne({ userId: USER_ID }).lean();
    assert.equal(sliders.sliders.jazz, 0.8, "jazz moet 0.8 blijven (locked)");
    assert.equal(sliders.sliders.rock, 0, "rock moet 0.0 zijn (clamped)");

    assert.ok(body.evolution, "evolution moet aanwezig zijn");
    assert.ok("rock" in body.evolution.changed, "changed moet rock bevatten");
    assert.equal(body.evolution.changed.jazz, undefined, "changed mag geen jazz bevatten");
  });
});

// Item I2: No sliders → create → evolve
describe("Item I2: No sliders → create → evolve", () => {
  it("eerste feedback evolution=null, na aanmaak sliders wel evolution", async () => {
    const track = await Track.create({
      title: "Evolve Track",
      artist: "Evolve Artist",
      genreVector: makeGenreVector({ rock: 0.6, pop: 0.4 }),
    });

    // Stap 1: feedback zonder sliders → evolution null
    const res1 = await fetch(`${baseUrl}/api/feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify({ trackId: track._id.toString(), action: "like" }),
    });
    assert.equal(res1.status, 201);
    const body1 = await res1.json();
    assert.equal(body1.evolution, null, "eerste feedback zonder sliders: evolution moet null zijn");

    // Stap 2: maak sliders aan
    await GenreSliders.create({
      userId: USER_ID,
      sliders: { rock: 1.0, pop: 0.5 },
    });

    // Stap 3: feedback opnieuw → nu met evolution
    // Verwijder oude feedback zodat upsert opnieuw triggert
    await Feedback.deleteMany({ userId: USER_ID });

    const res2 = await fetch(`${baseUrl}/api/feedback`, {
      method: "POST",
      headers,
      body: JSON.stringify({ trackId: track._id.toString(), action: "like" }),
    });
    assert.equal(res2.status, 201);
    const body2 = await res2.json();
    assert.ok(body2.evolution, "tweede feedback met sliders: evolution moet aanwezig zijn");
    assert.ok(
      Object.keys(body2.evolution.changed).length > 0,
      "evolution.changed moet delta's bevatten",
    );
  });
});
