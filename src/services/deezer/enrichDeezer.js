import Track from "../../models/Track.js";
import deezerClient from "./deezerClient.js";

// Deezer public API rate limit is ~50 requests / 5 seconds.
// We'll limit to ~5 requests/second (200ms delay) to be safe.
const RATE_LIMIT_DELAY = 200;

export async function enrichTracksWithDeezer({batchSize = 50, onProgress} = {}) {
    // Find tracks without previewUrl
    const tracks = await Track.find({previewUrl: {$exists: false}}).limit(batchSize);

    const result = {
        total: tracks.length,
        enriched: 0,
        skipped: 0,
        failed: 0,
        errors: [],
    };

    for (const track of tracks) {
        try {
            const deezerTrack = await deezerClient.searchTrack(track.artist, track.title);

            if (deezerTrack && deezerTrack.preview) {
                track.previewUrl = deezerTrack.preview;
                // Optionally store deezerId if we want to add it to schema later
                // track.deezerId = deezerTrack.id;
                await track.save();
                result.enriched++;
            } else {
                result.skipped++;
            }
        } catch (error) {
            console.error(`Error enriching track ${track._id} with Deezer:`, error.message);
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

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
    }

    return result;
}


