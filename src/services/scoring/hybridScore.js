const DEFAULT_WEIGHTS = Object.freeze({ genre: 0.5, cf: 0.5 });
const SIGNAL_KEYS = ["genre", "cf"];

/**
 * Hybride scoring: (alpha*genre + beta*cf) × delta*feedback
 * Re-normaliseert gewichten over beschikbare signalen (som=1.0).
 *
 * @param {{ genre?: number|null, cf?: number|null }} signals
 * @param {{ genre?: number, cf?: number }} [weights]
 * @param {number} [feedbackMultiplier=1.0]
 * @returns {{ finalScore: number, signals: object, appliedWeights: object, feedbackMultiplier: number }}
 */
export function hybridScore(signals, weights = DEFAULT_WEIGHTS, feedbackMultiplier = 1.0) {
  const w = weights ?? DEFAULT_WEIGHTS;

  // Determine which signals are available (not null/undefined)
  const available = SIGNAL_KEYS.filter((k) => signals[k] != null && typeof signals[k] === "number");

  // Build output signals (null for unavailable)
  const outputSignals = {};
  for (const k of SIGNAL_KEYS) {
    outputSignals[k] = signals[k] ?? null;
  }

  // No signals → score 0
  if (available.length === 0) {
    const zeroWeights = {};
    for (const k of SIGNAL_KEYS) zeroWeights[k] = 0;
    return {
      finalScore: 0,
      signals: outputSignals,
      appliedWeights: zeroWeights,
      feedbackMultiplier,
    };
  }

  // Re-normalize weights over available signals
  const rawSum = available.reduce((sum, k) => sum + (w[k] ?? 0), 0);
  const appliedWeights = {};
  for (const k of SIGNAL_KEYS) {
    if (available.includes(k)) {
      appliedWeights[k] = rawSum > 0 ? (w[k] ?? 0) / rawSum : 0;
    } else {
      appliedWeights[k] = 0;
    }
  }

  // Weighted sum
  let weightedSum = 0;
  for (const k of available) {
    weightedSum += appliedWeights[k] * signals[k];
  }

  const finalScore = weightedSum * feedbackMultiplier;

  return { finalScore, signals: outputSignals, appliedWeights, feedbackMultiplier };
}

export { DEFAULT_WEIGHTS };
