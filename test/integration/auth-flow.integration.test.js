import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import apiRouter from "../../routes/index.js";
import User from "../../src/models/User.js";
import ApiKey from "../../src/models/ApiKey.js";
import GenreSliders from "../../src/models/GenreSliders.js";
import Feedback from "../../src/models/Feedback.js";

let mongod, server, baseUrl;
const JWT_SECRET = "test-auth-flow-secret";

before(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.BASE_URI = "http://localhost:0/api/v1";

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());
  // Mount de volledige router met alle middleware (validateApiKey → authenticateJWT → injectUserId)
  app.use("/api/v1", apiRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

beforeEach(async () => {
  await User.deleteMany({});
  await ApiKey.deleteMany({});
  await GenreSliders.deleteMany({});
  await Feedback.deleteMany({});
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongod.stop();
  delete process.env.JWT_SECRET;
});

// Helper: signup + login + api key aanmaken
async function createAuthenticatedUser(username = "testuser") {
  // 1. Signup
  const signupRes = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      email: `${username}@test.com`,
      password: "password123",
    }),
  });
  assert.equal(signupRes.status, 201, "signup moet 201 zijn");
  const { id: userId } = await signupRes.json();

  // 2. Login
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "password123" }),
  });
  assert.equal(loginRes.status, 200, "login moet 200 zijn");
  const { token } = await loginRes.json();

  // 3. API key aanmaken
  const keyRes = await fetch(`${baseUrl}/api/v1/api-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: "Test App" }),
  });
  assert.equal(keyRes.status, 201, "api key aanmaken moet 201 zijn");
  const { key: apiKey } = await keyRes.json();

  return { userId, token, apiKey };
}

// Helper: headers voor beschermde routes
function authHeaders(token, apiKey) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-API-Key": apiKey,
  };
}

describe("Volledige auth flow: signup → login → api key → beschermde routes", () => {
  it("doorloopt de hele setup flow succesvol", async () => {
    const { userId, token, apiKey } = await createAuthenticatedUser();
    assert.ok(userId, "userId moet bestaan");
    assert.ok(token, "token moet bestaan");
    assert.ok(apiKey.startsWith("sk_live_"), "apiKey moet sk_live_ prefix hebben");
  });
});

describe("Beschermde routes zonder auth", () => {
  it("401 zonder headers op genres", async () => {
    const res = await fetch(`${baseUrl}/api/v1/genres`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.message.includes("API-Key"), "moet API key fout melden");
  });

  it("401 met alleen API key (geen JWT)", async () => {
    const { apiKey } = await createAuthenticatedUser();
    const res = await fetch(`${baseUrl}/api/v1/genres`, {
      headers: { "X-API-Key": apiKey },
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.message.includes("Authorization"), "moet JWT fout melden");
  });

  it("401 met alleen JWT (geen API key)", async () => {
    const { token } = await createAuthenticatedUser();
    const res = await fetch(`${baseUrl}/api/v1/genres`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.message.includes("API-Key"), "moet API key fout melden");
  });

  it("200 met beide headers op genres", async () => {
    const { token, apiKey } = await createAuthenticatedUser();
    const res = await fetch(`${baseUrl}/api/v1/genres`, {
      headers: authHeaders(token, apiKey),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.items.length > 0, "moet genres retourneren");
  });
});

describe("injectUserId: body.userId wordt overschreven door JWT", () => {
  it("onboarding gebruikt JWT userId, niet megestuurde userId", async () => {
    const { userId, token, apiKey } = await createAuthenticatedUser();

    const res = await fetch(`${baseUrl}/api/v1/onboarding`, {
      method: "POST",
      headers: authHeaders(token, apiKey),
      body: JSON.stringify({
        userId: "attacker-fake-id",
        genres: ["rock", "pop", "jazz"],
        artists: [],
        app: "poppy",
      }),
    });
    assert.equal(res.status, 201);

    // Check dat de sliders voor de ECHTE user zijn aangemaakt, niet voor "attacker-fake-id"
    const realSliders = await GenreSliders.findOne({ userId });
    assert.ok(realSliders, "sliders moeten bestaan voor de JWT user");

    const fakeSliders = await GenreSliders.findOne({ userId: "attacker-fake-id" });
    assert.equal(fakeSliders, null, "sliders mogen NIET bestaan voor de fake userId");
  });

  it("onboarding werkt zonder userId in body", async () => {
    const { userId, token, apiKey } = await createAuthenticatedUser();

    const res = await fetch(`${baseUrl}/api/v1/onboarding`, {
      method: "POST",
      headers: authHeaders(token, apiKey),
      body: JSON.stringify({
        genres: ["rock", "electronic", "jazz"],
        artists: [],
        app: "poppy",
      }),
    });
    assert.equal(res.status, 201);

    const sliders = await GenreSliders.findOne({ userId });
    assert.ok(sliders, "sliders moeten aangemaakt zijn met JWT userId");
  });

  it("feedback POST injecteert userId uit JWT", async () => {
    const { userId, token, apiKey } = await createAuthenticatedUser();
    const trackId = new mongoose.Types.ObjectId().toString();

    const res = await fetch(`${baseUrl}/api/v1/feedback`, {
      method: "POST",
      headers: authHeaders(token, apiKey),
      body: JSON.stringify({ trackId, action: "like" }),
    });
    assert.equal(res.status, 201);

    const doc = await Feedback.findOne({ userId, trackId });
    assert.ok(doc, "feedback moet bestaan voor JWT userId");
    assert.equal(doc.action, "like");
  });
});

describe("injectUserId: :userId param validatie", () => {
  it("200 als :userId matcht met JWT user", async () => {
    const { userId, token, apiKey } = await createAuthenticatedUser();

    // Maak eerst sliders aan via onboarding
    await fetch(`${baseUrl}/api/v1/onboarding`, {
      method: "POST",
      headers: authHeaders(token, apiKey),
      body: JSON.stringify({
        genres: ["rock", "pop", "jazz"],
        artists: [],
        app: "poppy",
      }),
    });

    const res = await fetch(`${baseUrl}/api/v1/sliders/${userId}`, {
      headers: authHeaders(token, apiKey),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.sliders, "moet sliders retourneren");
  });

  it("403 als :userId NIET matcht met JWT user", async () => {
    const { token, apiKey } = await createAuthenticatedUser();
    const otherUserId = new mongoose.Types.ObjectId().toString();

    const res = await fetch(`${baseUrl}/api/v1/sliders/${otherUserId}`, {
      headers: authHeaders(token, apiKey),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.message.includes("does not match"), "moet mismatch fout melden");
  });

  it("403 bij feedback ophalen voor andere user", async () => {
    const { token, apiKey } = await createAuthenticatedUser();
    const otherUserId = new mongoose.Types.ObjectId().toString();

    const res = await fetch(`${baseUrl}/api/v1/feedback/${otherUserId}`, {
      headers: authHeaders(token, apiKey),
    });
    assert.equal(res.status, 403);
  });

  it("403 bij blacklist ophalen voor andere user", async () => {
    const { token, apiKey } = await createAuthenticatedUser();
    const otherUserId = new mongoose.Types.ObjectId().toString();

    const res = await fetch(`${baseUrl}/api/v1/blacklist/${otherUserId}`, {
      headers: authHeaders(token, apiKey),
    });
    assert.equal(res.status, 403);
  });
});

describe("Twee users kunnen elkaars data niet zien", () => {
  it("user A kan niet bij sliders van user B", async () => {
    const userA = await createAuthenticatedUser("userA");
    const userB = await createAuthenticatedUser("userB");

    // Beide doen onboarding
    for (const user of [userA, userB]) {
      await fetch(`${baseUrl}/api/v1/onboarding`, {
        method: "POST",
        headers: authHeaders(user.token, user.apiKey),
        body: JSON.stringify({
          genres: ["rock", "pop", "jazz"],
          artists: [],
          app: "poppy",
        }),
      });
    }

    // User A probeert sliders van user B op te halen
    const res = await fetch(`${baseUrl}/api/v1/sliders/${userB.userId}`, {
      headers: authHeaders(userA.token, userA.apiKey),
    });
    assert.equal(res.status, 403, "user A mag niet bij sliders van user B");

    // User B kan eigen sliders WEL ophalen
    const resOwn = await fetch(`${baseUrl}/api/v1/sliders/${userB.userId}`, {
      headers: authHeaders(userB.token, userB.apiKey),
    });
    assert.equal(resOwn.status, 200, "user B mag eigen sliders ophalen");
  });
});
