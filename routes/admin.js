import { Router } from "express";
import { ifAdmin } from "../src/middleware/onlyAdmin.js";
import {
  getAlgorithmConfig,
  updateAlgorithmConfig,
  resetAlgorithmConfig,
} from "../src/services/admin/configLoader.js";
import { explainTrackScore } from "../src/services/admin/explainScore.js";

const router = Router();

// GET /api/v1/admin/config — retourneer huidige configuratie
router.get("/config", ifAdmin, async (req, res) => {
  const config = await getAlgorithmConfig();
  res.json(config);
});

// PATCH /api/v1/admin/config — partial update
router.patch("/config", ifAdmin, async (req, res) => {
  const allowed = [
    "hybridWeights",
    "feedbackMultipliers",
    "cfWeights",
    "profileEvolution",
    "playCount",
    "dialPresets",
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: "No valid fields to update" });
  }

  try {
    const config = await updateAlgorithmConfig(updates, req.user.id);
    res.json(config);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/v1/admin/config/reset — reset naar defaults
router.post("/config/reset", ifAdmin, async (req, res) => {
  const config = await resetAlgorithmConfig();
  res.json(config);
});

// GET /api/v1/admin/explain/:trackId — per-track score breakdown
router.get("/explain/:trackId", ifAdmin, async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ message: "userId query parameter is required" });
  }

  const result = await explainTrackScore(req.params.trackId, userId);
  if (!result) {
    return res.status(404).json({ message: "Track not found" });
  }

  res.json(result);
});

export default router;
