import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import SliderPreset from "../../src/models/SliderPreset.js";

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

beforeEach(async () => {
  await SliderPreset.deleteMany({});
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("SliderPreset model", () => {
  it("maakt een valid preset aan", async () => {
    const preset = await SliderPreset.create({
      userId: "user-1",
      name: "My Preset",
      sliders: { rock: 1.0, pop: 0.5 },
      locked: ["rock"],
    });

    assert.equal(preset.userId, "user-1");
    assert.equal(preset.name, "My Preset");
    assert.equal(preset.sliders.get("rock"), 1.0);
    assert.equal(preset.sliders.get("pop"), 0.5);
    assert.deepEqual(preset.locked, ["rock"]);
    assert.equal(preset.isDefault, false);
  });

  it("vereist userId", async () => {
    await assert.rejects(
      () => SliderPreset.create({ name: "No User" }),
      (err) => err.name === "ValidationError",
    );
  });

  it("vereist name", async () => {
    await assert.rejects(
      () => SliderPreset.create({ userId: "user-1" }),
      (err) => err.name === "ValidationError",
    );
  });

  it("enforced compound unique index op userId + name", async () => {
    await SliderPreset.create({
      userId: "user-1",
      name: "Duplicate",
      sliders: { rock: 1.0 },
    });

    await assert.rejects(
      () =>
        SliderPreset.create({
          userId: "user-1",
          name: "Duplicate",
          sliders: { pop: 0.5 },
        }),
      (err) => err.code === 11000,
    );
  });

  it("staat dezelfde naam toe voor verschillende users", async () => {
    await SliderPreset.create({
      userId: "user-1",
      name: "Same Name",
      sliders: { rock: 1.0 },
    });

    const preset2 = await SliderPreset.create({
      userId: "user-2",
      name: "Same Name",
      sliders: { pop: 0.5 },
    });

    assert.equal(preset2.name, "Same Name");
  });

  it("heeft timestamps", async () => {
    const preset = await SliderPreset.create({
      userId: "user-1",
      name: "Timestamped",
      sliders: { rock: 1.0 },
    });

    assert.ok(preset.createdAt instanceof Date);
    assert.ok(preset.updatedAt instanceof Date);
  });

  it("isDefault default naar false", async () => {
    const preset = await SliderPreset.create({
      userId: "user-1",
      name: "Not Default",
      sliders: { rock: 1.0 },
    });

    assert.equal(preset.isDefault, false);
  });

  it("sliders defaults naar lege Map", async () => {
    const preset = await SliderPreset.create({
      userId: "user-1",
      name: "Empty Sliders",
    });

    assert.equal(preset.sliders.size, 0);
  });

  it("locked defaults naar lege array", async () => {
    const preset = await SliderPreset.create({
      userId: "user-1",
      name: "No Locked",
      sliders: { rock: 1.0 },
    });

    assert.deepEqual(preset.locked, []);
  });
});
