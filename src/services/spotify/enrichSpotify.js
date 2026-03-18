import Track from "../../models/Track.js";

export async function enrichTracks(client, { batchSize = 50, onProgress } = {}) {
  // Find all tracks that don't have a spotifyId yet
  const tracks = await Track.find({ spotifyId: { $exists: false } }).limit(batchSize);

  const result = {
    total: tracks.length,
    enriched: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const track of tracks) {
    try {
      const spotifyData = await client.searchTrack(track.artist, track.title);

      if (spotifyData && spotifyData.spotifyId) {
        await Track.findByIdAndUpdate(track._id, {
          $set: spotifyData,
        });
        result.enriched++;
      } else {
        result.skipped++;
      }
    } catch (error) {
      console.error(`Error enriching track ${track._id}:`, error.message);
      result.failed++;
      result.errors.push(error.message);
    }

    if (onProgress) {
      onProgress({
        enriched: result.enriched,
        skipped: result.skipped,
        failed: result.failed,
        total: result.total,
        current: result.enriched + result.skipped + result.failed,
      });
    }
  }

  return result;
}
