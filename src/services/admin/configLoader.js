import AlgorithmConfig from "../../models/AlgorithmConfig.js";

export const DEFAULT_ALGORITHM_CONFIG = Object.freeze({
  hybridWeights: Object.freeze({ genre: 0.5, cf: 0.5 }),
  feedbackMultipliers: Object.freeze({ like: 1.1, dislike: 0.5, library: 1.2, skip: 0.9 }),
  cfWeights: Object.freeze({ track: 0.7, artist: 0.3 }),
  profileEvolution: Object.freeze({ like: 0.1, library: 0.15, dislike: -0.15, skip: -0.05 }),
  playCount: Object.freeze({ threshold: 10, bonus: 0.05, halfLifeDays: 30 }),
  dialPresets: Object.freeze([]),
});

export async function getAlgorithmConfig() {
  let config = await AlgorithmConfig.findOne();
  if (!config) {
    config = await AlgorithmConfig.create({});
  }
  return config;
}

export async function updateAlgorithmConfig(updates, userId) {
  const config = await getAlgorithmConfig();

  const mergeFields = [
    "hybridWeights",
    "feedbackMultipliers",
    "cfWeights",
    "profileEvolution",
    "playCount",
  ];

  for (const field of mergeFields) {
    if (updates[field]) {
      for (const [key, value] of Object.entries(updates[field])) {
        config[field][key] = value;
      }
      config.markModified(field);
    }
  }

  if (updates.dialPresets !== undefined) {
    config.dialPresets = updates.dialPresets;
  }

  config.updatedBy = userId;
  await config.save();
  return config;
}

export async function resetAlgorithmConfig() {
  await AlgorithmConfig.deleteMany({});
  return AlgorithmConfig.create({});
}
