import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import AlgorithmConfig from "../../src/models/AlgorithmConfig.js";
import {
  getAlgorithmConfig,
  updateAlgorithmConfig,
  resetAlgorithmConfig,
} from "../../src/services/admin/configLoader.js";

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

describe("configLoader", () => {
  describe("getAlgorithmConfig", () => {
    it("lazy seeds defaults when no document exists", async () => {
      const config = await getAlgorithmConfig();
      assert.ok(config);
      assert.deepEqual(config.hybridWeights.toObject(), { genre: 0.5, cf: 0.5 });
    });

    it("returns existing document on subsequent calls", async () => {
      const first = await getAlgorithmConfig();
      const second = await getAlgorithmConfig();
      assert.equal(String(first._id), String(second._id));
    });
  });

  describe("updateAlgorithmConfig", () => {
    it("partial merge — only overwrites provided fields", async () => {
      await getAlgorithmConfig(); // seed
      const userId = "admin-test-user";
      const updated = await updateAlgorithmConfig(
        { hybridWeights: { genre: 0.7, cf: 0.3 } },
        userId,
      );
      assert.deepEqual(updated.hybridWeights.toObject(), { genre: 0.7, cf: 0.3 });
      // Other fields unchanged
      assert.deepEqual(updated.feedbackMultipliers.toObject(), {
        like: 1.1,
        dislike: 0.5,
        library: 1.2,
        skip: 0.9,
      });
      assert.equal(String(updated.updatedBy), String(userId));
    });

    it("validates on update — rejects invalid hybridWeights", async () => {
      await getAlgorithmConfig();
      const userId = "admin-test-user";
      await assert.rejects(() =>
        updateAlgorithmConfig({ hybridWeights: { genre: 0.3, cf: 0.3 } }, userId),
      );
    });

    it("updates dialPresets array", async () => {
      await getAlgorithmConfig();
      const userId = "admin-test-user";
      const updated = await updateAlgorithmConfig(
        {
          dialPresets: [
            { position: 1, threshold: 0.8, sortSignal: "genreSim", unplayedOnly: false },
          ],
        },
        userId,
      );
      assert.equal(updated.dialPresets.length, 1);
      assert.equal(updated.dialPresets[0].threshold, 0.8);
    });
  });

  describe("resetAlgorithmConfig", () => {
    it("deletes and re-seeds with defaults", async () => {
      const userId = "admin-test-user";
      // Modify first
      await getAlgorithmConfig();
      await updateAlgorithmConfig({ hybridWeights: { genre: 0.7, cf: 0.3 } }, userId);

      const reset = await resetAlgorithmConfig();
      assert.deepEqual(reset.hybridWeights.toObject(), { genre: 0.5, cf: 0.5 });
    });
  });
});
