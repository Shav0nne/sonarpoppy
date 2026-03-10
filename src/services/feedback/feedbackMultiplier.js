const ACTION_MULTIPLIERS = Object.freeze({
  like: 1.1,
  dislike: 0.5,
  library: 1.2,
  skip: 0.9,
});

/**
 * Berekent feedback multiplier op basis van action en play count.
 *
 * Action multiplier: like=1.1, dislike=0.5, library=1.2, skip=0.9, null/geen=1.0
 * Play count bonus: 10+ plays geeft ×1.05 extra, met time decay (halfwaardetijd 30 dagen).
 *
 * @param {{ action?: string|null, playCount?: number, lastPlayedAt?: Date|string } | null} feedback
 * @param {{ like?: number, dislike?: number, library?: number, skip?: number, playThreshold?: number, playBonus?: number, halfLifeDays?: number } | null} config - Optional overrides
 * @returns {number}
 */
const PLAY_COUNT_THRESHOLD = 10;
const PLAY_COUNT_BONUS = 0.05;
const HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dagen

export function getFeedbackMultiplier(feedback, config = null) {
  if (feedback == null) return 1.0;

  const multipliers = config ? { ...ACTION_MULTIPLIERS, ...config } : ACTION_MULTIPLIERS;
  const actionMultiplier = multipliers[feedback.action] ?? 1.0;

  const threshold = config?.playThreshold ?? PLAY_COUNT_THRESHOLD;
  const bonus = config?.playBonus ?? PLAY_COUNT_BONUS;
  const halfLifeMs = (config?.halfLifeDays ?? 30) * 24 * 60 * 60 * 1000;

  // Play count bonus: threshold+ plays × time decay
  let playCountMultiplier = 1.0;
  if (feedback.playCount >= threshold && feedback.lastPlayedAt != null) {
    const elapsed = Date.now() - new Date(feedback.lastPlayedAt).getTime();
    const decayFactor = Math.pow(0.5, elapsed / halfLifeMs);
    playCountMultiplier = 1 + bonus * decayFactor;
  }

  return actionMultiplier * playCountMultiplier;
}
