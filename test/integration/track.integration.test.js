import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Track from "../../src/models/Track.js";

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

const baseTrack = {
  title: "Bohemian Rhapsody",
  artist: "Queen",
  album: "A Night at the Opera",
  duration: 354,
  genreVector: new Array(20).fill(0),
};

// REQ-004: Unique compound index op artist+title
describe("Unique compound index artist+title", () => {
  it("voorkomt duplicate artist+title combinaties", async () => {
    await Track.create(baseTrack);
    await assert.rejects(
      () => Track.create({ ...baseTrack }),
      (err) => {
        assert.equal(err.code, 11000);
        return true;
      },
    );
  });

  it("staat zelfde title met andere artist toe", async () => {
    await Track.create(baseTrack);
    const track2 = await Track.create({
      ...baseTrack,
      artist: "Other Artist",
    });
    assert.ok(track2._id);
  });

  it("staat zelfde artist met andere title toe", async () => {
    await Track.create(baseTrack);
    const track2 = await Track.create({
      ...baseTrack,
      title: "Another Song",
    });
    assert.ok(track2._id);
  });
});

// REQ-005: Losse index op artist
describe("Artist index", () => {
  it("heeft een index op het artist veld", () => {
    const indexes = Track.schema.indexes();
    const artistIndex = indexes.find(([fields]) => fields.artist === 1 && !fields.title);
    assert.ok(artistIndex, "losse artist index bestaat");
  });

  it("heeft een compound index op artist+title", () => {
    const indexes = Track.schema.indexes();
    const compoundIndex = indexes.find(([fields]) => fields.artist === 1 && fields.title === 1);
    assert.ok(compoundIndex, "compound artist+title index bestaat");
    assert.equal(compoundIndex[1].unique, true);
  });
});

// REQ-006: CRUD operaties
describe("Track CRUD operaties", () => {
  it("create: slaat track op met timestamps", async () => {
    const track = await Track.create(baseTrack);
    assert.ok(track._id);
    assert.equal(track.title, "Bohemian Rhapsody");
    assert.equal(track.artist, "Queen");
    assert.ok(track.createdAt instanceof Date);
    assert.ok(track.updatedAt instanceof Date);
  });

  it("read: vindt track op _id", async () => {
    const created = await Track.create(baseTrack);
    const found = await Track.findById(created._id);
    assert.ok(found);
    assert.equal(found.title, created.title);
  });

  it("update: wijzigt velden en updatedAt", async () => {
    const track = await Track.create(baseTrack);
    const originalUpdated = track.updatedAt;

    track.album = "Greatest Hits";
    await track.save();

    const updated = await Track.findById(track._id);
    assert.equal(updated.album, "Greatest Hits");
    assert.ok(updated.updatedAt >= originalUpdated);
  });

  it("delete: verwijdert track", async () => {
    const track = await Track.create(baseTrack);
    await Track.deleteOne({ _id: track._id });
    const found = await Track.findById(track._id);
    assert.equal(found, null);
  });

  it("trim: verwijdert whitespace van title en artist", async () => {
    const track = await Track.create({
      ...baseTrack,
      title: "  Bohemian Rhapsody  ",
      artist: "  Queen  ",
    });
    assert.equal(track.title, "Bohemian Rhapsody");
    assert.equal(track.artist, "Queen");
  });
});
