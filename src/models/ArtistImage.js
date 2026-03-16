import mongoose from "mongoose";

const artistImageSchema = new mongoose.Schema({
  artist: {
    type: String,
    required: true,
    lowercase: true,
  },
  images: [
    {
      url: { type: String, required: true },
      size: { type: String, required: true },
      _id: false,
    },
  ],
  fetchedAt: {
    type: Date,
    default: Date.now,
  },
});

artistImageSchema.index({ artist: 1 }, { unique: true });

const ArtistImage = mongoose.model("ArtistImage", artistImageSchema);

export default ArtistImage;
