import User from "../models/User.js";

/**
 * Middleware to ensure the authenticated user has completed onboarding.
 * Assumes `authenticateJWT` has already run and populated `req.user`.
 *
 * Fast path: if `req.user.hasCompletedOnboarding` is already set to `true`
 * (e.g. by a test stub or a prior middleware), the DB lookup is skipped.
 */
export async function requireOnboarding(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Unauthorized: User not found in request." });
  }

  // Fast path: already verified by an earlier middleware or test stub
  if (req.user.hasCompletedOnboarding === true) {
    return next();
  }

  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.hasCompletedOnboarding) {
      return res.status(403).json({ message: "Onboarding is nog niet voltooid." });
    }

    req.user.hasCompletedOnboarding = true;
    next();
  } catch (err) {
    console.error("Error in requireOnboarding middleware:", err);
    return res.status(500).json({ message: "Internal server error during onboarding check." });
  }
}

