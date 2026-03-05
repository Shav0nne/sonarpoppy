import { Router } from "express";
import { GENRES } from "../src/config/genres.js";

const router = Router();

router.get("/", (req, res) => {
  const items = GENRES.map((name, index) => ({ index, name }));
  res.json({
    items,
    _links: { self: { href: "/api/genres" } },
  });
});

export default router;
