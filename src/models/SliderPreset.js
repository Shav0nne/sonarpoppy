import mongoose from "mongoose";

const sliderPresetSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    sliders: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
    locked: {
      type: [String],
      default: [],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

sliderPresetSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model("SliderPreset", sliderPresetSchema);
