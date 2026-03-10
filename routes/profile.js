import { Router } from "express";
import { computeProfileVector } from "../src/services/profile/computeProfile.js";
import GenreSliders from "../src/models/GenreSliders.js";

const router = Router();

router.post("/compute", async (req, res) => {
  const { userId, weights } = req.body;

  let effectiveWeights = weights;

  // userId heeft voorrang: haal sliders op als weights
  if (userId) {
    const doc = await GenreSliders.findOne({ userId });
    if (doc) {
      effectiveWeights = Object.fromEntries(doc.sliders);
    }
    // Geen document → cold start (lege weights → equal distribution)
  }

  const { vector, meta } = computeProfileVector(effectiveWeights);

  res.json({
    vector,
    meta,
    _links: {
      self: { href: "/api/profile/compute" },
      recommendations: { href: "/api/recommendations" },
    },
  });
});

export default router;
