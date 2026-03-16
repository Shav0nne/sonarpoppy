import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import AlgorithmConfig from "../../src/models/AlgorithmConfig.js";

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

beforeEach(async () => {
  await AlgorithmConfig.deleteMany({});
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("AlgorithmConfig model", () => {
  it("creates with valid defaults", async () => {
    const config = await AlgorithmConfig.create({});
    assert.deepEqual(config.hybridWeights.toObject(), { genre: 0.5, cf: 0.5 });
    assert.deepEqual(config.feedbackMultipliers.toObject(), {
      like: 1.1,
      dislike: 0.5,
      library: 1.2,
      skip: 0.9,
    });
    assert.deepEqual(config.cfWeights.toObject(), { track: 0.7, artist: 0.3 });
    assert.deepEqual(config.profileEvolution.toObject(), {
      like: 0.1,
      library: 0.15,
      dislike: -0.15,
      skip: -0.05,
    });
    assert.deepEqual(config.playCount.toObject(), {
      threshold: 10,
      bonus: 0.05,
      halfLifeDays: 30,
    });
    assert.equal(config.dialPresets.length, 0);
  });

  it("validates hybridWeights sum must equal 1.0", async () => {
    await assert.rejects(
      () => AlgorithmConfig.create({ hybridWeights: { genre: 0.3, cf: 0.3 } }),
      (err) => {
        assert.ok(err.message.includes("sum"));
        return true;
      },
    );
  });

  it("validates cfWeights sum must equal 1.0", async () => {
    await assert.rejects(
      () => AlgorithmConfig.create({ cfWeights: { track: 0.5, artist: 0.2 } }),
      (err) => {
        assert.ok(err.message.includes("sum"));
        return true;
      },
    );
  });

  it("validates feedbackMultipliers are positive", async () => {
    await assert.rejects(() =>
      AlgorithmConfig.create({
        feedbackMultipliers: { like: -1, dislike: 0.5, library: 1.2, skip: 0.9 },
      }),
    );
  });

  it("validates playCount threshold is positive", async () => {
    await assert.rejects(() =>
      AlgorithmConfig.create({ playCount: { threshold: -1, bonus: 0.05, halfLifeDays: 30 } }),
    );
  });

  it("validates dialPresets position must be 1-5", async () => {
    await assert.rejects(() =>
      AlgorithmConfig.create({
        dialPresets: [{ position: 6, threshold: 0.5, sortSignal: "genreSim", unplayedOnly: false }],
      }),
    );
  });

  it("validates dialPresets sortSignal enum", async () => {
    await assert.rejects(() =>
      AlgorithmConfig.create({
        dialPresets: [{ position: 1, threshold: 0.5, sortSignal: "invalid", unplayedOnly: false }],
      }),
    );
  });

  it("has updatedAt and updatedBy fields", async () => {
    const userId = "admin-user-123";
    const config = await AlgorithmConfig.create({ updatedBy: userId });
    assert.ok(config.updatedAt);
    assert.equal(config.updatedBy, userId);
  });
});
