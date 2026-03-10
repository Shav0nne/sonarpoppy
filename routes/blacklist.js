import { Router } from "express";
import Blacklist from "../src/models/Blacklist.js";
import { resolveAlias } from "../src/config/genres.js";

const router = Router();

// GET /api/v1/blacklist/:userId -> Get the blacklist for a user
router.get("/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const blacklist = await Blacklist.findOne({ userId }).lean();

    const entries = blacklist ? blacklist.entries : [];

    res.json({
      userId,
      entries,
      _links: {
        self: `/api/v1/blacklist/${userId}`,
        add: `/api/v1/blacklist/${userId}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/blacklist/:userId -> Add an entry to the blacklist
router.post("/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    let { type, value } = req.body;

    if (!type || !value) {
      return res.status(400).json({ error: "Type and value are required" });
    }

    if (!["track", "artist", "genre"].includes(type)) {
      return res.status(400).json({ error: "Invalid type. Must be track, artist, or genre" });
    }

    if (type === "genre") {
      const resolved = resolveAlias(value);
      if (!resolved) {
        return res.status(400).json({ error: `Invalid genre: ${value}` });
      }
      value = resolved;
    }

    // Upsert the tracking doc
    let blacklist = await Blacklist.findOne({ userId });
    if (!blacklist) {
      blacklist = new Blacklist({ userId, entries: [] });
    }

    // Check for duplicates
    const isDuplicate = blacklist.entries.some(
      (entry) => entry.type === type && entry.value === value,
    );
    if (isDuplicate) {
      return res.status(409).json({ error: "Entry already exists in blacklist" });
    }

    blacklist.entries.push({ type, value });
    await blacklist.save();

    const newEntry = blacklist.entries[blacklist.entries.length - 1];

    res.status(201).json({
      userId,
      entries: blacklist.entries,
      _links: {
        self: `/api/v1/blacklist/${userId}`,
        remove: `/api/v1/blacklist/${userId}/${newEntry._id}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/blacklist/:userId/:entryId -> Remove an entry from the blacklist
router.delete("/:userId/:entryId", async (req, res, next) => {
  try {
    const { userId, entryId } = req.params;

    const blacklist = await Blacklist.findOne({ userId });
    if (!blacklist) {
      return res.status(404).json({ error: "Blacklist not found for user" });
    }

    const entryIndex = blacklist.entries.findIndex((e) => e._id.toString() === entryId);
    if (entryIndex === -1) {
      return res.status(404).json({ error: "Entry not found in blacklist" });
    }

    blacklist.entries.splice(entryIndex, 1);
    await blacklist.save();

    res.json({
      userId,
      entries: blacklist.entries,
      _links: {
        self: `/api/v1/blacklist/${userId}`,
        add: `/api/v1/blacklist/${userId}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
