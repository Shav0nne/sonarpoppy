import { Router } from "express";
import { authenticateJWT } from "../src/middleware/authMiddleware.js";
import ApiKey from "../src/models/ApiKey.js";
import { generateApiKey, hashApiKey } from "../src/services/apikeys/generateKey.js";

const router = Router();
const MAX_ACTIVE_KEYS = 5;

// All routes require JWT
router.use(authenticateJWT);

// POST / — create a new API key
router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Missing required field: name" });
  }

  const activeCount = await ApiKey.countDocuments({
    userId: req.user.id,
    active: true,
  });
  if (activeCount >= MAX_ACTIVE_KEYS) {
    return res.status(409).json({ message: "Maximum 5 active API keys reached" });
  }

  const { key, prefix } = generateApiKey();
  const keyHash = await hashApiKey(key);

  const doc = await ApiKey.create({
    userId: req.user.id,
    name,
    prefix,
    keyHash,
  });

  res.status(201).json({
    id: doc._id.toString(),
    name: doc.name,
    prefix: doc.prefix,
    key,
    active: doc.active,
    createdAt: doc.createdAt,
  });
});

// GET / — list all keys for the authenticated user
router.get("/", async (req, res) => {
  const keys = await ApiKey.find({ userId: req.user.id }).sort({
    createdAt: -1,
  });
  res.json({
    items: keys.map((k) => ({
      id: k._id.toString(),
      name: k.name,
      prefix: k.prefix,
      active: k.active,
      createdAt: k.createdAt,
    })),
  });
});

// DELETE /:id — revoke (soft-delete) an API key
router.delete("/:id", async (req, res) => {
  const key = await ApiKey.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { active: false },
    { new: true },
  );
  if (!key) {
    return res.status(404).json({ message: "API key not found" });
  }
  res.json({
    id: key._id.toString(),
    name: key.name,
    prefix: key.prefix,
    active: key.active,
  });
});

export default router;
