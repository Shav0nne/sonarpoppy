import { Router } from "express";
import { computeProfileVector } from "../src/services/profile/computeProfile.js";

const router = Router();

router.post("/compute", (req, res) => {
  const { weights } = req.body;
  const { vector, meta } = computeProfileVector(weights);

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
