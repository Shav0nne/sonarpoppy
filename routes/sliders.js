import { Router } from "express";
import GenreSliders from "../src/models/GenreSliders.js";
import { GENRES } from "../src/config/genres.js";

const router = Router();

const GENRE_SET = new Set(GENRES);

/** Bouw cold start defaults (alle genres 1.0, locked leeg) */
function coldStartResponse() {
  const sliders = {};
  for (const genre of GENRES) {
    sliders[genre] = 1.0;
  }
  return { sliders, locked: [], updatedAt: null };
}

/** Converteer Map naar plain object voor response */
function slidersToObject(doc) {
  const sliders = {};
  for (const [key, value] of doc.sliders) {
    sliders[key] = value;
  }
  return {
    sliders,
    locked: doc.locked,
    updatedAt: doc.updatedAt,
  };
}

// GET / — retourneer slider state (of cold start defaults)
router.get("/", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const doc = await GenreSliders.findOne({ userId });
  if (!doc) {
    return res.json(coldStartResponse());
  }
  res.json(slidersToObject(doc));
});

// PUT / — upsert slider state
router.put("/", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { sliders, locked } = req.body;

  // Valideer genre keys in sliders
  if (sliders && typeof sliders === "object") {
    const unknownKeys = Object.keys(sliders).filter((k) => !GENRE_SET.has(k));
    if (unknownKeys.length > 0) {
      return res.status(400).json({
        error: `Onbekende genre keys: ${unknownKeys.join(", ")}`,
      });
    }
  }

  // Valideer locked genres
  if (locked && Array.isArray(locked)) {
    const invalidLocked = locked.filter((g) => !GENRE_SET.has(g));
    if (invalidLocked.length > 0) {
      return res.status(400).json({
        error: `Ongeldige locked genres: ${invalidLocked.join(", ")}`,
      });
    }
  }

  const update = {};
  if (sliders) {
    for (const [key, value] of Object.entries(sliders)) {
      update[`sliders.${key}`] = value;
    }
  }
  if (locked) {
    update.locked = locked;
  }

  const doc = await GenreSliders.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true, upsert: true, runValidators: true },
  );

  res.json(slidersToObject(doc));
});

// POST /reset — reset naar defaults
router.post("/reset", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const doc = await GenreSliders.findOne({ userId });
  if (!doc) {
    return res.status(404).json({ error: "Geen slider document gevonden" });
  }

  const defaultMap = new Map();
  for (const genre of GENRES) {
    defaultMap.set(genre, 1.0);
  }
  doc.sliders = defaultMap;
  doc.locked = [];
  await doc.save();

  res.json(slidersToObject(doc));
});

export default router;
