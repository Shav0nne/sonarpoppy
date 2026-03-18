import { Router } from "express";
import SliderPreset from "../src/models/SliderPreset.js";
import GenreSliders from "../src/models/GenreSliders.js";
import { DEFAULT_PRESETS } from "../src/config/defaultPresets.js";
import { requireOnboarding } from "../src/middleware/onboardingMiddleware.js";

const router = Router();
router.use(requireOnboarding);

const MAX_PRESETS = 5;

/** Converteer Map-based sliders naar plain object */
function presetToJSON(doc) {
  const obj = doc.toObject();
  if (obj.sliders instanceof Map) {
    obj.sliders = Object.fromEntries(obj.sliders);
  }
  return obj;
}

/** Seed 3 default presets voor nieuwe user */
async function seedDefaults(userId) {
  const docs = DEFAULT_PRESETS.map((p) => ({
    userId,
    name: p.name,
    sliders: p.sliders,
    locked: p.locked,
    isDefault: true,
  }));
  await SliderPreset.insertMany(docs);
  return SliderPreset.find({ userId }).lean();
}

// GET / — lijst alle presets (lazy seed bij eerste call)
router.get("/", async (req, res) => {
  const userId = req.user.id;
  let presets = await SliderPreset.find({ userId });

  if (presets.length === 0) {
    const seeded = await seedDefaults(userId);
    return res.json(seeded);
  }

  res.json(presets.map(presetToJSON));
});

// POST / — maak nieuwe preset aan
router.post("/", async (req, res) => {
  const userId = req.user.id;
  const { name, sliders, locked } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "Naam is verplicht" });
  }

  // Check max 5
  const count = await SliderPreset.countDocuments({ userId });
  if (count >= MAX_PRESETS) {
    return res.status(400).json({ error: `Maximum ${MAX_PRESETS} presets bereikt` });
  }

  try {
    const preset = await SliderPreset.create({
      userId,
      name: name.trim(),
      sliders: sliders || {},
      locked: locked || [],
    });
    res.status(201).json(presetToJSON(preset));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: `Preset met naam "${name.trim()}" bestaat al` });
    }
    throw err;
  }
});

// PATCH /:presetId — update preset
router.patch("/:presetId", async (req, res) => {
  const userId = req.user.id;
  const { presetId } = req.params;
  const { name, sliders, locked } = req.body;

  const update = {};
  if (name !== undefined) update.name = name.trim();
  if (sliders !== undefined) update.sliders = sliders;
  if (locked !== undefined) update.locked = locked;

  try {
    const preset = await SliderPreset.findOneAndUpdate(
      { _id: presetId, userId },
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!preset) {
      return res.status(404).json({ error: "Preset niet gevonden" });
    }

    res.json(presetToJSON(preset));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: `Preset met naam "${name}" bestaat al` });
    }
    throw err;
  }
});

// DELETE /:presetId — verwijder preset
router.delete("/:presetId", async (req, res) => {
  const userId = req.user.id;
  const { presetId } = req.params;

  const preset = await SliderPreset.findOneAndDelete({
    _id: presetId,
    userId,
  });

  if (!preset) {
    return res.status(404).json({ error: "Preset niet gevonden" });
  }

  res.status(204).end();
});

// POST /:presetId/apply — pas preset toe op GenreSliders
router.post("/:presetId/apply", async (req, res) => {
  const userId = req.user.id;
  const { presetId } = req.params;

  const preset = await SliderPreset.findOne({ _id: presetId, userId });
  if (!preset) {
    return res.status(404).json({ error: "Preset niet gevonden" });
  }

  const slidersObj = Object.fromEntries(preset.sliders);
  const update = {
    sliders: slidersObj,
    locked: preset.locked,
  };

  const doc = await GenreSliders.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true, upsert: true, runValidators: true },
  );

  const result = {};
  for (const [key, value] of doc.sliders) {
    result[key] = value;
  }

  res.json({
    sliders: result,
    locked: doc.locked,
    updatedAt: doc.updatedAt,
  });
});

export default router;
