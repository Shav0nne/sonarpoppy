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

  req.apiKey = { id: doc._id.toString(), userId: doc.userId.toString() };
  next();
}
