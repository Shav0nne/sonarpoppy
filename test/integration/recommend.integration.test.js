import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Track from "../../src/models/Track.js";
import { getRecommendations } from "../../src/services/recommendation/recommend.js";

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Track.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Track.deleteMany({});
});

const v = (primary) => {
  const vec = new Array(20).fill(0);
  vec[primary] = 1;
  return vec;
};

describe("getRecommendations — integration met MongoDB", () => {
  it("laadt tracks uit MongoDB en scoort ze", async () => {
    await Track.create([
      { title: "Rock Hit", artist: "A", genreVector: v(0) },
      { title: "Pop Song", artist: "B", genreVector: v(1) },
      { title: "Jazz Tune", artist: "C", genreVector: v(5) },
    ]);

    const result = await getRecommendations({ profileVector: v(0) });

    assert.equal(result.total, 3);
    assert.equal(result.tracks[0].track.title, "Rock Hit");
    assert.equal(result.tracks[0].score, 1);
  });

  it("skipt tracks zonder genreVector in MongoDB", async () => {
    await Track.create([
      { title: "With Vector", artist: "A", genreVector: v(0) },
      { title: "Without Vector", artist: "B" },
    ]);

    const result = await getRecommendations({ profileVector: v(0) });
    assert.equal(result.total, 1);
    assert.equal(result.tracks[0].track.title, "With Vector");
  });

  it("pagination werkt end-to-end", async () => {
    await Track.create([
      { title: "T1", artist: "A", genreVector: v(0) },
      { title: "T2", artist: "B", genreVector: v(0) },
      { title: "T3", artist: "C", genreVector: v(0) },
    ]);

    const page = await getRecommendations({ profileVector: v(0), limit: 2, offset: 1 });
    assert.equal(page.tracks.length, 2);
    assert.equal(page.total, 3);
  });

  it("retourneert lege resultaten bij lege database", async () => {
    const result = await getRecommendations({ profileVector: v(0) });
    assert.equal(result.total, 0);
    assert.equal(result.tracks.length, 0);
    assert.equal(result.meta.avgScore, 0);
  });
});
