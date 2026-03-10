import { Router } from "express";
import genresRouter from "./genres.js";
import tracksRouter from "./tracks.js";
import profileRouter from "./profile.js";
import recommendationsRouter from "./recommendations.js";
import dialRouter from "./dial.js";
import feedbackRouter from "./feedback.js";
import slidersRouter from "./sliders.js";
import onboardingRouter from "./onboarding.js";
import usersRouter from "./users.js";
import authRouter from "./auth.js";
import apiKeysRouter from "./api-keys.js";
import blacklistRouter from "./blacklist.js";
import { validateApiKey } from "../src/middleware/apiKeyMiddleware.js";

const router = Router();

// Routes NOT protected by API key (JWT-only or public)
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/api-keys", apiKeysRouter);

// API key required for all routes below
router.use(validateApiKey);

router.use("/genres", genresRouter);
router.use("/tracks", tracksRouter);
router.use("/profile", profileRouter);
router.use("/recommendations", recommendationsRouter);
router.use("/dial", dialRouter);
router.use("/feedback", feedbackRouter);
router.use("/sliders", slidersRouter);
router.use("/onboarding", onboardingRouter);
router.use("/blacklist", blacklistRouter);

export default router;
