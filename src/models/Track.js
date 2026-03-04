import mongoose from "mongoose";
import { GENRE_COUNT } from "../config/genres.js";

const trackSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    artist: { type: String, required: true, trim: true },
    album: { type: String, trim: true },
    duration: { type: Number, min: 0 },
    genreVector: {
      type: [Number],
      validate: {
        validator(vec) {
          if (vec.length === 0) return true;
          if (vec.length !== GENRE_COUNT) return false;
          return vec.every((v) => v >= 0 && v <= 1);
        },
        message: `genreVector must be exactly ${GENRE_COUNT} numbers between 0.0 and 1.0`,
      },
    },
    lastfmUrl: { type: String },
    lastfmTags: { type: [String] },
    mbid: { type: String },
    imageUrl: { type: String },
  },
  { timestamps: true },
);

trackSchema.index({ artist: 1, title: 1 }, { unique: true });
trackSchema.index({ artist: 1 });

export default mongoose.model("Track", trackSchema);
