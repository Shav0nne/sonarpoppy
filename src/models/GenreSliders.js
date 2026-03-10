import mongoose from "mongoose";
import { GENRES } from "../config/genres.js";

const defaultSliders = () => {
  const map = new Map();
  for (const genre of GENRES) {
    map.set(genre, 1.0);
  }
  return map;
};

const genreSlidersSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    sliders: {
      type: Map,
      of: Number,
      default: defaultSliders,
    },
    locked: {
      type: [
        {
          type: String,
          enum: GENRES,
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

genreSlidersSchema.index({ userId: 1 }, { unique: true });

export default mongoose.model("GenreSliders", genreSlidersSchema);
