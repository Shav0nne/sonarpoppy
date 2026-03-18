import { Router } from "express";
import { DIAL_PRESETS } from "../src/config/dial.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    presets: DIAL_PRESETS,
    default: 3,
    _links: {
      self: { href: "/api/dial" },
      recommendations: { href: "/api/recommendations" },
    },
  });
});

export default router;
