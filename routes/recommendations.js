import { Router } from "express";
import { getRecommendations } from "../src/services/recommendation/recommend.js";

const router = Router();

router.post("/", async (req, res) => {
  const { profileVector, limit, offset, filters, weights, dial } = req.body;
  if (!Array.isArray(profileVector)) {
    return res.status(400).json({ error: "profileVector array is required" });
  }

  const result = await getRecommendations({ profileVector, limit, offset, filters, weights, dial });

  res.json({
    ...result,
    _links: {
      self: { href: "/api/recommendations" },
      profile: { href: "/api/profile/compute" },
    },
  });
});

export default router;
