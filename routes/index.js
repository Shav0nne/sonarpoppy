import { Router } from "express";
import genresRouter from "./genres.js";
import tracksRouter from "./tracks.js";
import profileRouter from "./profile.js";
import recommendationsRouter from "./recommendations.js";
import dialRouter from "./dial.js";
import feedbackRouter from "./feedback.js";
import slidersRouter from "./sliders.js";
import usersRouter from "./users.js";
import authRouter from "./auth.js";
import blacklistRouter from "./blacklist.js";

const router = Router();

router.use("/genres", genresRouter);
router.use("/tracks", tracksRouter);
router.use("/profile", profileRouter);
router.use("/recommendations", recommendationsRouter);
router.use("/dial", dialRouter);
router.use("/feedback", feedbackRouter);
router.use("/sliders", slidersRouter);
router.use("/users", usersRouter);
router.use("/auth", authRouter);
router.use("/blacklist", blacklistRouter);

export default router;
