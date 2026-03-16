import { Router } from "express";
import { createLastfmClient } from "../src/services/lastfm/client.js";
import { getArtistImage } from "../src/services/artists/artistImageService.js";

const router = Router();

const lastfmClient = createLastfmClient({
  apiKey: process.env.LASTFM_API_KEY,
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
