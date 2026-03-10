import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import GenreSliders from "../../src/models/GenreSliders.js";
import { GENRES } from "../../src/config/genres.js";

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("GenreSliders model", () => {
  it("slaat op met userId en default sliders (alle genres 1.0)", async () => {
    const doc = await GenreSliders.create({ userId: "user-defaults" });
    assert.equal(doc.userId, "user-defaults");
    assert.equal(doc.sliders.size, GENRES.length);
    for (const genre of GENRES) {
      assert.equal(doc.sliders.get(genre), 1.0);
    }
    assert.deepEqual(doc.locked, []);
  });

  it("userId is required", async () => {
    await assert.rejects(() => GenreSliders.create({}), {
      name: "ValidationError",
    });
  });

  it("userId is unique", async () => {
    await GenreSliders.create({ userId: "user-unique-test" });
    await assert.rejects(() => GenreSliders.create({ userId: "user-unique-test" }));
  });

  it("accepteert custom slider waarden", async () => {
    const sliders = new Map();
    sliders.set("rock", 2.5);
    sliders.set("jazz", 0.3);
    const doc = await GenreSliders.create({ userId: "user-custom", sliders });
    assert.equal(doc.sliders.get("rock"), 2.5);
    assert.equal(doc.sliders.get("jazz"), 0.3);
  });

  it("locked array accepteert geldige genres", async () => {
    const doc = await GenreSliders.create({
      userId: "user-locked",
      locked: ["rock", "jazz"],
    });
    assert.deepEqual([...doc.locked], ["rock", "jazz"]);
  });

  it("locked array rejecteert ongeldige genres", async () => {
    await assert.rejects(
      () => GenreSliders.create({ userId: "user-bad-lock", locked: ["nonexistent-genre"] }),
      { name: "ValidationError" },
    );
  });

  it("heeft timestamps (createdAt, updatedAt)", async () => {
    const doc = await GenreSliders.create({ userId: "user-timestamps" });
    assert.ok(doc.createdAt instanceof Date);
    assert.ok(doc.updatedAt instanceof Date);
  });
});
