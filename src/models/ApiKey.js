import mongoose from "mongoose";

const apiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    prefix: { type: String, required: true },
    keyHash: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

apiKeySchema.index({ prefix: 1 }, { unique: true });
apiKeySchema.index({ userId: 1 });

const ApiKey = mongoose.model("ApiKey", apiKeySchema);

export default ApiKey;
