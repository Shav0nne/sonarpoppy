import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import ApiKey from "../../src/models/ApiKey.js";

const validKey = {
  userId: new mongoose.Types.ObjectId(),
  name: "My App",
  prefix: "sk_live_1234567890abcdef",
  keyHash: "$2b$10$fakehashvaluefortesting1234567890",
};

describe("ApiKey schema velden", () => {
  it("heeft alle verwachte paden", () => {
    const paths = Object.keys(ApiKey.schema.paths);
    const expected = [
      "userId",
      "name",
      "prefix",
      "keyHash",
      "active",
      "createdAt",
      "updatedAt",
      "_id",
      "__v",
    ];
    for (const field of expected) {
      assert.ok(paths.includes(field), `missing path: ${field}`);
    }
  });

  it("userId is required ObjectId met ref User", () => {
    const p = ApiKey.schema.path("userId");
    assert.equal(p.options.ref, "User");
    assert.equal(p.options.required, true);
  });

  it("name is required String", () => {
    const p = ApiKey.schema.path("name");
    assert.equal(p.options.type, String);
    assert.equal(p.options.required, true);
  });

  it("prefix is required String", () => {
    const p = ApiKey.schema.path("prefix");
    assert.equal(p.options.type, String);
    assert.equal(p.options.required, true);
  });

  it("keyHash is required String", () => {
    const p = ApiKey.schema.path("keyHash");
    assert.equal(p.options.type, String);
    assert.equal(p.options.required, true);
  });

  it("active defaults to true", () => {
    const doc = new ApiKey(validKey);
    assert.equal(doc.active, true);
  });

  it("timestamps zijn enabled", () => {
    assert.ok(ApiKey.schema.paths.createdAt, "createdAt exists");
    assert.ok(ApiKey.schema.paths.updatedAt, "updatedAt exists");
  });
});

describe("ApiKey validatie", () => {
  it("accepteert geldig document", () => {
    const doc = new ApiKey(validKey);
    const err = doc.validateSync();
    assert.equal(err, undefined);
  });

  it("faalt zonder userId", () => {
    const doc = new ApiKey({ ...validKey, userId: undefined });
    const err = doc.validateSync();
    assert.ok(err);
    assert.ok(err.errors.userId);
  });

  it("faalt zonder name", () => {
    const doc = new ApiKey({ ...validKey, name: undefined });
    const err = doc.validateSync();
    assert.ok(err);
    assert.ok(err.errors.name);
  });

  it("faalt zonder prefix", () => {
    const doc = new ApiKey({ ...validKey, prefix: undefined });
    const err = doc.validateSync();
    assert.ok(err);
    assert.ok(err.errors.prefix);
  });

  it("faalt zonder keyHash", () => {
    const doc = new ApiKey({ ...validKey, keyHash: undefined });
    const err = doc.validateSync();
    assert.ok(err);
    assert.ok(err.errors.keyHash);
  });
});

describe("ApiKey indexen", () => {
  it("heeft unique index op prefix", () => {
    const indexes = ApiKey.schema.indexes();
    const prefixIdx = indexes.find(([fields]) => fields.prefix === 1);
    assert.ok(prefixIdx, "prefix index exists");
    assert.equal(prefixIdx[1].unique, true);
  });

  it("heeft index op userId", () => {
    const indexes = ApiKey.schema.indexes();
    const userIdx = indexes.find(([fields]) => fields.userId === 1);
    assert.ok(userIdx, "userId index exists");
  });
});
