import { Router } from "express";
import Feedback from "../src/models/Feedback.js";
import { validateUserParam } from "../src/middleware/apiKeyMiddleware.js";

const router = Router();
router.param("userId", validateUserParam);

// POST /api/feedback — create of update feedback voor een user-track paar
router.post("/", async (req, res) => {
  const { trackId, action } = req.body;
  const userId = req.user?.id;
  
  if (!userId || !trackId) {
    return res.status(400).json({ error: "userId and trackId are required" });
  }

  const doc = await Feedback.findOneAndUpdate(
    { userId, trackId },
    { action },
    { upsert: true, new: true, runValidators: true },
  );

  res.status(201).json(doc);
});

// GET /api/feedback/:userId — alle feedback voor een user
router.get("/:userId", async (req, res) => {
  const docs = await Feedback.find({ userId: req.params.userId }).lean();
  res.json(docs);
});

// GET /api/feedback/:userId/:trackId — feedback voor specifiek user-track paar
router.get("/:userId/:trackId", async (req, res) => {
  const doc = await Feedback.findOne({
    userId: req.params.userId,
    trackId: req.params.trackId,
  }).lean();

  if (!doc) {
    return res.status(404).json({ error: "Feedback not found" });
  }
  res.json(doc);
});

// DELETE /api/feedback/:userId/:trackId — feedback verwijderen
router.delete("/:userId/:trackId", async (req, res) => {
  const result = await Feedback.deleteOne({
    userId: req.params.userId,
    trackId: req.params.trackId,
  });

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: "Feedback not found" });
  }
  res.status(204).end();
});

// POST /api/feedback/:userId/:trackId/play — play count incrementen
router.post("/:userId/:trackId/play", async (req, res) => {
  const doc = await Feedback.findOneAndUpdate(
    { userId: req.params.userId, trackId: req.params.trackId },
    { $inc: { playCount: 1 }, lastPlayedAt: new Date() },
    { upsert: true, new: true, runValidators: true },
  );

  res.json(doc);
});

export default router;
