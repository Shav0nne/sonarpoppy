import { Router } from "express";
import Track from "../src/models/Track.js";
import { createLastfmClient } from "../src/services/lastfm/client.js";
import { ingestTrack, ingestBatch } from "../src/services/ingestion/ingest.js";

const router = Router();

const client = createLastfmClient({ apiKey: process.env.LASTFM_API_KEY });

router.get("/", async (req, res) => {
  const tracks = await Track.find().lean();
  res.json({
    items: tracks,
    _links: {
      self: { href: "/api/tracks" },
      ingest: { href: "/api/tracks/ingest" },
    },
  });
});

router.post("/ingest", async (req, res) => {
  const { artist, title, force } = req.body;
  if (!artist || !title) {
    return res.status(400).json({ error: "artist and title are required" });
  }

  const result = await ingestTrack(client, artist, title, { force });
  const status = result.status === "created" ? 201 : 200;

  res.status(status).json({
    ...result,
    _links: {
      self: { href: "/api/tracks/ingest" },
      tracks: { href: "/api/tracks" },
    },
  });
});

router.post("/ingest-batch", async (req, res) => {
  const { tracks, force } = req.body;
  if (!Array.isArray(tracks)) {
    return res.status(400).json({ error: "tracks array is required" });
  }

  const result = await ingestBatch(client, tracks, { force });

  res.json({
    ...result,
    _links: {
      self: { href: "/api/tracks/ingest-batch" },
      tracks: { href: "/api/tracks" },
    },
  });
});

export default router;
