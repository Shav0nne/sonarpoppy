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

    // Onboard first
    await fetch(`${baseUrl}/api/v1/onboarding`, {
      method: "POST",
      headers: authHeaders(token, apiKey),
      body: JSON.stringify({ genres: ["rock", "pop", "jazz"], artists: [], app: "poppy" }),
    });

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

describe("JWT-gebaseerde toegang: iedere user ziet alleen eigen data", () => {
  it("GET /sliders retourneert eigen sliders via JWT", async () => {
    const { userId, token, apiKey } = await createAuthenticatedUser();

    // Maak eerst sliders aan via onboarding
    await fetch(`${baseUrl}/api/v1/onboarding`, {
      method: "POST",
      headers: authHeaders(token, apiKey),
      body: JSON.stringify({ genres: ["rock", "pop", "jazz"], artists: [], app: "poppy" }),
    });

    const res = await fetch(`${baseUrl}/api/v1/sliders`, {
      headers: authHeaders(token, apiKey),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.sliders, "moet sliders retourneren");
  });

  it("GET /blacklist retourneert eigen (lege) blacklist via JWT", async () => {
    const { token, apiKey } = await createAuthenticatedUser();

    // Onboard first
    await fetch(`${baseUrl}/api/v1/onboarding`, {
      method: "POST",
      headers: authHeaders(token, apiKey),
      body: JSON.stringify({ genres: ["rock", "pop", "jazz"], artists: [], app: "poppy" }),
    });

    const res = await fetch(`${baseUrl}/api/v1/blacklist`, {
      headers: authHeaders(token, apiKey),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.entries, []);
  });

  it("404 bij feedback ophalen voor andere user (data isolatie)", async () => {
    const { token, apiKey } = await createAuthenticatedUser();
    const otherUserId = new mongoose.Types.ObjectId().toString();

    // Onboard first
    await fetch(`${baseUrl}/api/v1/onboarding`, {
      method: "POST",
      headers: authHeaders(token, apiKey),
      body: JSON.stringify({ genres: ["rock", "pop", "jazz"], artists: [], app: "poppy" }),
    });

    // Zelfs als we een userId van iemand anders meesturen in het pad (wat nu als trackId wordt gezien),
    // krijgen we 404 omdat de query gefilterd is op ONZE userId uit de JWT.
    const res = await fetch(`${baseUrl}/api/v1/feedback/${otherUserId}`, {
      headers: authHeaders(token, apiKey),
    });
    assert.equal(res.status, 404);
  });
});

describe("Twee users kunnen elkaars data niet zien", () => {
  it("user A en user B zien allebei hun eigen sliders", async () => {
    const userA = await createAuthenticatedUser("userA");
    const userB = await createAuthenticatedUser("userB");

    // Beide doen onboarding met verschillende genres
    await fetch(`${baseUrl}/api/v1/onboarding`, {
      method: "POST",
      headers: authHeaders(userA.token, userA.apiKey),
      body: JSON.stringify({ genres: ["rock", "pop", "jazz"], artists: [], app: "poppy" }),
    });
    await fetch(`${baseUrl}/api/v1/onboarding`, {
      method: "POST",
      headers: authHeaders(userB.token, userB.apiKey),
      body: JSON.stringify({ genres: ["electronic", "ambient", "dance"], artists: [], app: "poppy" }),
    });

    // User A ziet eigen sliders via JWT
    const resA = await fetch(`${baseUrl}/api/v1/sliders`, {
      headers: authHeaders(userA.token, userA.apiKey),
    });
    assert.equal(resA.status, 200);
    const bodyA = await resA.json();
    assert.equal(bodyA.sliders.rock, 1.0, "user A moet rock=1.0 hebben");

    // User B ziet eigen sliders via JWT
    const resB = await fetch(`${baseUrl}/api/v1/sliders`, {
      headers: authHeaders(userB.token, userB.apiKey),
    });
    assert.equal(resB.status, 200);
    const bodyB = await resB.json();
    assert.equal(bodyB.sliders.electronic, 1.0, "user B moet electronic=1.0 hebben");

    // Data is gescheiden: user B heeft geen rock=1.0 (zit op default 0.1)
    assert.equal(bodyB.sliders.rock, 0.1, "user B heeft rock niet gekozen, moet 0.1 zijn");
  });
});

