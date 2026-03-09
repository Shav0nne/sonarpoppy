/**
 * Gewichten per action voor profiel evolutie.
 * Positief = boost genre weights richting track, negatief = weg ervan.
 */
const ACTION_WEIGHTS = Object.freeze({
  like: 0.1,
  library: 0.15,
  dislike: -0.15,
  skip: -0.05,
});

/**
 * Evolueert profiel weights op basis van feedback.
 * Gewogen gemiddelde: liked/library tracks boosten genre weights,
 * disliked/skip tracks verlagen ze.
 *
 * @param {Object} currentWeights — genre index → weight (bijv. {"0": 1.0, "5": 1.2})
 * @param {Array<{action: string|null, trackId: string}>} feedbackItems
 * @param {Array<{_id: string, genreVector: number[]}>} tracks
 * @returns {Object} evolved weights (nieuw object, muteert input niet)
 */
export function evolveProfileWeights(currentWeights, feedbackItems, tracks) {
  if (!feedbackItems?.length) return { ...currentWeights };

  const trackMap = new Map(tracks.map((t) => [String(t._id), t]));
  const evolved = { ...currentWeights };

  for (const fb of feedbackItems) {
    const weight = ACTION_WEIGHTS[fb.action];
    if (weight == null) continue; // null/undefined action → skip

    const track = trackMap.get(String(fb.trackId));
    if (!track?.genreVector) continue;

    for (let i = 0; i < track.genreVector.length; i++) {
      const key = String(i);
      const influence = track.genreVector[i] * weight;
      evolved[key] = (evolved[key] ?? 0) + influence;
    }
  }

  return evolved;
}
