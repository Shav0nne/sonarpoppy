import Track from "../../models/Track.js";

export async function enrichCfData(lastfmClient, { batchSize = 50 } = {}) {
  const tracks = await Track.find({ cfEnrichedAt: null }).limit(batchSize);

  const result = {
    total: tracks.length,
    enriched: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Deduplicate artist.getSimilar calls — one call per unique artist
  const artistCache = new Map();

  for (const track of tracks) {
    try {
      const similarTracks = await lastfmClient.getTrackSimilar(track.artist, track.title);

      // artist.getSimilar (deduplicated)
      const artistKey = track.artist.toLowerCase();
      let similarArtists;
      if (artistCache.has(artistKey)) {
        similarArtists = artistCache.get(artistKey);
      } else {
        similarArtists = await lastfmClient.getArtistSimilar(track.artist);
        artistCache.set(artistKey, similarArtists);
      }

      if (similarTracks.length === 0 && similarArtists.length === 0) {
        result.skipped++;
        await Track.findByIdAndUpdate(track._id, {
          $set: { similarTracks: [], similarArtists: [], cfEnrichedAt: new Date() },
        });
        continue;
      }

      await Track.findByIdAndUpdate(track._id, {
        $set: { similarTracks, similarArtists, cfEnrichedAt: new Date() },
      });
      result.enriched++;
    } catch (error) {
      result.failed++;
      result.errors.push(`${track.artist} - ${track.title}: ${error.message}`);
    }
  }

  return result;
}
