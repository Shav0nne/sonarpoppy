import { Router } from "express";
import genresRouter from "./genres.js";
import tracksRouter from "./tracks.js";
import profileRouter from "./profile.js";
import recommendationsRouter from "./recommendations.js";
import dialRouter from "./dial.js";

const router = Router();

router.use("/genres", genresRouter);
router.use("/tracks", tracksRouter);
router.use("/profile", profileRouter);
router.use("/recommendations", recommendationsRouter);
router.use("/dial", dialRouter);

export default router;
