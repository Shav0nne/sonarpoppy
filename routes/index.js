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
import sliderPresetsRouter from "./slider-presets.js";
import adminRouter from "./admin.js";
import artistsRouter from "./artists.js";
import friendRouter from "./friends.js";
import { validateApiKey, injectUserId } from "../src/middleware/apiKeyMiddleware.js";
import { authenticateJWT } from "../src/middleware/authMiddleware.js";

const router = Router();

// Routes NOT protected by API key (JWT-only or public)
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/api-keys", apiKeysRouter);
router.use("/friends", friendRouter);

// Beschermde routes: API key (app-level) + JWT (user-level) + userId injectie
router.use(validateApiKey);
router.use(authenticateJWT);
router.use(injectUserId);

router.use("/genres", genresRouter);
router.use("/tracks", tracksRouter);
router.use("/profile", profileRouter);
router.use("/recommendations", recommendationsRouter);
router.use("/dial", dialRouter);
router.use("/onboarding", onboardingRouter);
router.use("/feedback", feedbackRouter);
router.use("/sliders", slidersRouter);
router.use("/blacklist", blacklistRouter);
router.use("/slider-presets", sliderPresetsRouter);
router.use("/artists", artistsRouter);
router.use("/admin", adminRouter);

export default router;
