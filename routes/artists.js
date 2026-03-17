import { Router } from "express";
import Track from "../src/models/Track.js";
import { createLastfmClient } from "../src/services/lastfm/client.js";
import { getArtistImage } from "../src/services/artists/artistImageService.js";

const router = Router();

const lastfmClient = createLastfmClient({
  apiKey: process.env.LASTFM_API_KEY,
});

router.get("/search", async (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 2) {
    return res.status(400).json({ error: "Query must be at least 2 characters" });
  }

  const regex = new RegExp(q, "i");
  const dbArtists = await Track.distinct("artist", { artist: regex });

  let lastfmArtists = [];
  try {
    lastfmArtists = await lastfmClient.searchArtists(q);
  } catch {
    // Graceful — Last.fm down is niet blokkerend
  }

  const seen = new Set(dbArtists.map((a) => a.toLowerCase()));
  const merged = dbArtists.map((name) => ({ name }));

  for (const a of lastfmArtists) {
    const key = a.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({ name: a.name });
    }
  }

  res.json({ results: merged.slice(0, 10) });
});

router.get("/:name/image", async (req, res) => {
  const result = await getArtistImage(req.params.name, lastfmClient);

  if (!result) {
    return res.status(404).json({ error: "Artist not found" });
  }

  res.json({
    artist: result.artist,
    images: result.images,
    fetchedAt: result.fetchedAt,
  });
});

export default router;
