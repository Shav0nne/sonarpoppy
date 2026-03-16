import { Router } from "express";
import Feedback from "../src/models/Feedback.js";
import Track from "../src/models/Track.js";
import GenreSliders from "../src/models/GenreSliders.js";
import { evolveSliders } from "../src/services/feedback/sliderEvolution.js";
import { requireOnboarding } from "../src/middleware/onboardingMiddleware.js";

const router = Router();
router.use(requireOnboarding);

// POST /api/feedback — create of update feedback voor een user-track paar
router.post("/", async (req, res) => {
  const { trackId, action } = req.body;
  const userId = req.user?.id;

  if (!trackId) {
    return res.status(400).json({ error: "trackId is required" });
  }

  const doc = await Feedback.findOneAndUpdate(
    { userId, trackId },
    { action },
    { upsert: true, new: true, runValidators: true },
  );

  // Slider evolutie — fire-and-forget als GenreSliders niet bestaat
  let evolution = null;
  try {
    const [track, genreSliders] = await Promise.all([
      Track.findById(trackId).lean(),
      GenreSliders.findOne({ userId }).lean(),
    ]);

    if (track?.genreVector?.length && genreSliders) {
      const result = evolveSliders({
        currentSliders: new Map(Object.entries(genreSliders.sliders)),
        locked: genreSliders.locked ?? [],
        trackGenreVector: track.genreVector,
        action,
      });

      await GenreSliders.updateOne({ userId }, { sliders: Object.fromEntries(result.sliders) });

      evolution = { changed: result.changed, locked: result.locked };
    }
  } catch {
    // Evolutie mag niet de feedback response blokkeren
  }

  res.status(201).json({ ...doc.toObject(), evolution });
});

// GET /api/feedback — alle feedback voor de ingelogde user
router.get("/", async (req, res) => {
  const userId = req.user?.id;
  const docs = await Feedback.find({ userId }).lean();
  res.json(docs);
});

// GET /api/feedback/:trackId — feedback voor specifiek user-track paar
router.get("/:trackId", async (req, res) => {
  const userId = req.user?.id;
  const doc = await Feedback.findOne({
    userId,
    trackId: req.params.trackId,
  }).lean();

  if (!doc) {
    return res.status(404).json({ error: "Feedback not found" });
  }
  res.json(doc);
});

// DELETE /api/feedback/:trackId — feedback verwijderen
router.delete("/:trackId", async (req, res) => {
  const userId = req.user?.id;
  const result = await Feedback.deleteOne({
    userId,
    trackId: req.params.trackId,
  });

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: "Feedback not found" });
  }
  res.status(204).end();
});

// POST /api/feedback/:trackId/play — play count incrementen
router.post("/:trackId/play", async (req, res) => {
  const userId = req.user?.id;
  const doc = await Feedback.findOneAndUpdate(
    { userId, trackId: req.params.trackId },
    { $inc: { playCount: 1 }, lastPlayedAt: new Date() },
    { upsert: true, new: true, runValidators: true },
  );

  res.json(doc);
});

export default router;
