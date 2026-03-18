import { Router } from "express";
import { createLastfmClient } from "../src/services/lastfm/client.js";
import { processOnboarding } from "../src/services/onboarding/onboard.js";

const router = Router();

router.post("/", async (req, res) => {
  const { genres, artists, app } = req.body;
  const userId = req.user?.id;

  const lastfmClient = createLastfmClient({ apiKey: process.env.LASTFM_API_KEY });

  try {
    const { profile, sliders } = await processOnboarding({
      userId,
      genres,
      artists: artists || [],
      app,
      lastfmClient,
    });

    res.status(201).json({
      profile,
      sliders,
      _links: {
        self: { href: "/api/v1/onboarding" },
        sliders: { href: `/api/v1/sliders/${userId}` },
        recommendations: { href: `/api/v1/recommendations?userId=${userId}` },
      },
    });
  } catch (err) {
    if (err.message.match(/required|invalid|at least|must be/i)) {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
});

export default router;
