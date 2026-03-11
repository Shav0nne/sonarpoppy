import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import jwt from "jsonwebtoken";

import authRouter from "../../routes/auth.js";
import User from "../../src/models/User.js";

let mongod, server, baseUrl;
const JWT_SECRET = "auth-me-test-secret";

before(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

beforeEach(async () => {
  await User.deleteMany({});
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongod.stop();
});

describe("Auth Me & Onboarding Status", () => {
  it("POST /auth/login retourneert hasCompletedOnboarding", async () => {
    const user = new User({
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      hasCompletedOnboarding: true
    });
    await user.save();

    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "testuser", password: "password123" })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.hasCompletedOnboarding, true);
  });

  it("GET /auth/me retourneert user data inclusief hasCompletedOnboarding", async () => {
    const user = new User({
      username: "meuser",
      email: "me@example.com",
      password: "password123",
      hasCompletedOnboarding: false
    });
    await user.save();

    const token = jwt.sign({ sub: user._id.toString(), role: "user" }, JWT_SECRET);

    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.username, "meuser");
    assert.equal(body.hasCompletedOnboarding, false);
  });

  it("GET /auth/me retourneert 401 zonder token", async () => {
    const res = await fetch(`${baseUrl}/auth/me`);
    assert.equal(res.status, 401);
  });
});
