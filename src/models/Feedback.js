import mongoose from "mongoose";
import mongooseHistory from "mongoose-history";

const feedbackSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Track",
      required: true,
    },
    action: {
      type: String,
      enum: ["like", "dislike", "library", "skip", null],
      default: null,
    },
    playCount: { type: Number, default: 0 },
    lastPlayedAt: { type: Date },
  },
  { timestamps: true },
);

feedbackSchema.index({ userId: 1, trackId: 1 }, { unique: true });
feedbackSchema.index({ userId: 1 });
feedbackSchema.index({ trackId: 1 });

feedbackSchema.plugin(mongooseHistory, {
    historyCollection: "feedbacks_history",
    diffOnly: false,
    fullDocument: 'updateLookup'
});
export default mongoose.model("Feedback", feedbackSchema);
