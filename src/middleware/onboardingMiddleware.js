import User from "../models/User.js";

/**
 * Middleware to ensure the authenticated user has completed onboarding.
 * Assumes `authenticateJWT` has already run and populated `req.user`.
 */
export async function requireOnboarding(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Unauthorized: User not found in request." });
  }

  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.hasCompletedOnboarding) {
      // 403 Forbidden is appropriate when the user is known but lacks a requirement.
      return res.status(403).json({ message: "Onboarding is nog niet voltooid." });
    }

    // Pass the flag along if subsequent handlers need it
    req.user.hasCompletedOnboarding = true;

    next();
  } catch (err) {
    console.error("Error in requireOnboarding middleware:", err);
    return res.status(500).json({ message: "Internal server error during onboarding check." });
  }
}
