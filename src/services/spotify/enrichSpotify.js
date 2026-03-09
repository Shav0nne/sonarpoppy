import Track from "../../models/Track.js";

export async function enrichTracks(client) {
    // Find all tracks that don't have a spotifyId yet
    const tracks = await Track.find({ spotifyId: { $exists: false } });

    const result = {
        total: tracks.length,
        processed: 0,
        matched: 0,
        errors: 0,
        matches: [],
    };

    for (const track of tracks) {
        try {
            const spotifyData = await client.searchTrack(track.artist, track.title);
            result.processed++;

            if (spotifyData && spotifyData.spotifyId) {
                // Also fetch audio features
                const audioFeatures = await client.getAudioFeatures(spotifyData.spotifyId);

                // Update the track with all combined data
                await Track.findByIdAndUpdate(track._id, {
                    $set: {
                        ...spotifyData,
                        ...audioFeatures,
                    },
                });

                result.matched++;
                result.matches.push({
                    id: track._id.toString(),
                    artist: track.artist,
                    title: track.title,
                    spotifyId: spotifyData.spotifyId,
                });
            }
        } catch (error) {
            console.error(`Error enriching track ${track._id}:`, error.message);
            result.errors++;
        }
    }

    return result;
}
