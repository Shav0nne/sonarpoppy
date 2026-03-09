const TRACK_WEIGHT = 0.7;
const ARTIST_WEIGHT = 0.3;

/**
 * Berekent CF score per kandidaat-track op basis van item-based overlap.
 *
 * Track overlap (0.7) + artist overlap (0.3). Re-normalisatie als slechts
 * één signaal beschikbaar. null bij niet enriched of geen overlap.
 *
 * @param {object} candidateTrack - Track met similarTracks, similarArtists, cfEnrichedAt
 * @param {Set<string>} likedTrackKeys - Set van "artist|title" keys (lowercase)
 * @param {Set<string>} likedArtists - Set van artist names (lowercase)
 * @returns {number|null} Score 0-1, of null
 */
export function computeCfScore(candidateTrack, likedTrackKeys, likedArtists) {
  if (!candidateTrack.cfEnrichedAt) return null;

  const { similarTracks = [], similarArtists = [] } = candidateTrack;

  // Compute track overlap: avg match of overlapping similar tracks
  let trackScore = null;
  if (similarTracks.length > 0) {
    const matched = similarTracks.filter((t) => {
      const key = `${t.artist.toLowerCase()}|${t.title.toLowerCase()}`;
      return likedTrackKeys.has(key);
    });
    if (matched.length > 0) {
      trackScore = matched.reduce((sum, t) => sum + t.match, 0) / matched.length;
    }
  }

  // Compute artist overlap: avg match of overlapping similar artists
  let artistScore = null;
  if (similarArtists.length > 0) {
    const matched = similarArtists.filter((a) => likedArtists.has(a.artist.toLowerCase()));
    if (matched.length > 0) {
      artistScore = matched.reduce((sum, a) => sum + a.match, 0) / matched.length;
    }
  }

  // No overlap at all → null (pure booster, niet penalty)
  if (trackScore === null && artistScore === null) return null;

  // Re-normalize weights over available signals
  if (trackScore !== null && artistScore !== null) {
    return TRACK_WEIGHT * trackScore + ARTIST_WEIGHT * artistScore;
  }
  // Only one signal → full weight to that signal
  return trackScore ?? artistScore;
}
