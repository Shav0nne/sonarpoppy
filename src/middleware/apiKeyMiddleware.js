import ApiKey from "../models/ApiKey.js";
import { compareApiKey } from "../services/apikeys/generateKey.js";

export async function validateApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key) {
    return res.status(401).json({ message: "Missing X-API-Key header" });
  }

  // Extract prefix (first 16 chars) for DB lookup
  const prefix = key.slice(0, 16);
  const doc = await ApiKey.findOne({ prefix, active: true });
  if (!doc) {
    return res.status(401).json({ message: "Invalid API key" });
  }

  const match = await compareApiKey(key, doc.keyHash);
  if (!match) {
    return res.status(401).json({ message: "Invalid API key" });
  }

  req.apiKey = { id: doc._id.toString(), name: doc.name };
  next();
}

// Injecteert userId uit JWT token in body.
// Draait na authenticateJWT als globale middleware — req.user.id is de source of truth.
export function injectUserId(req, res, next) {
  const userId = req.user.id;

  if (req.body && typeof req.body === "object") {
    req.body.userId = userId;
  }

  next();
}

// Valideert dat :userId param matcht met de ingelogde user.
// Gebruik als router.param("userId", validateUserParam) in route files.
// Skipt de check als req.user niet bestaat (unit tests zonder auth middleware).
export function validateUserParam(req, res, next, userId) {
  if (req.user && userId !== req.user.id) {
    return res.status(403).json({ message: "userId does not match authenticated user" });
  }
  next();
}
