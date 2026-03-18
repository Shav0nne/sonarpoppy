import mongoose from "mongoose";
import mongooseHistory from "mongoose-history";

const { Schema } = mongoose;

const WEIGHT_SUM_TOLERANCE = 0.01;

function validateWeightSum(obj, keys, label) {
  const sum = keys.reduce((s, k) => s + (obj[k] ?? 0), 0);
  if (Math.abs(sum - 1.0) > WEIGHT_SUM_TOLERANCE) {
    throw new Error(`${label} sum must equal 1.0 (got ${sum})`);
  }
}

const dialPresetOverrideSchema = new Schema(
  {
    position: { type: Number, required: true, min: 1, max: 5 },
    threshold: { type: Number, default: null },
    sortSignal: { type: String, enum: ["genreSim", "cf", "random"], required: true },
    unplayedOnly: { type: Boolean, required: true },
  },
  { _id: false },
);

const algorithmConfigSchema = new Schema(
  {
    hybridWeights: {
      genre: { type: Number, default: 0.5, min: 0 },
      cf: { type: Number, default: 0.5, min: 0 },
    },
    feedbackMultipliers: {
      like: { type: Number, default: 1.1, min: 0 },
      dislike: { type: Number, default: 0.5, min: 0 },
      library: { type: Number, default: 1.2, min: 0 },
      skip: { type: Number, default: 0.9, min: 0 },
    },
    cfWeights: {
      track: { type: Number, default: 0.7, min: 0 },
      artist: { type: Number, default: 0.3, min: 0 },
    },
    profileEvolution: {
      like: { type: Number, default: 0.1 },
      library: { type: Number, default: 0.15 },
      dislike: { type: Number, default: -0.15 },
      skip: { type: Number, default: -0.05 },
    },
    playCount: {
      threshold: { type: Number, default: 10, min: 0 },
      bonus: { type: Number, default: 0.05, min: 0 },
      halfLifeDays: { type: Number, default: 30, min: 1 },
    },
    dialPresets: [dialPresetOverrideSchema],
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

algorithmConfigSchema.pre("validate", function () {
  validateWeightSum(this.hybridWeights, ["genre", "cf"], "hybridWeights");
  validateWeightSum(this.cfWeights, ["track", "artist"], "cfWeights");
});

algorithmConfigSchema.plugin(mongooseHistory, { historyCollection: "algorithm_configs_history", diffOnly: false, fullDocument: 'updateLookup' });
export default mongoose.model("AlgorithmConfig", algorithmConfigSchema);
