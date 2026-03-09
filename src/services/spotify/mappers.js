export function mapSpotifyTrack(item) {
    if (!item) return null;

    return {
        spotifyId: item.id,
        spotifyUri: item.uri,
        duration: Math.round(item.duration_ms / 1000) || null,
        explicit: Boolean(item.explicit),
        albumImages: item.album?.images?.map((img) => ({
            url: img.url,
            height: img.height,
            width: img.width,
        })) || [],
    };
}

export function mapAudioFeatures(features) {
    if (!features) return {};

    return {
        danceability: features.danceability,
        tempo: features.tempo,
        acousticness: features.acousticness,
        energy: features.energy,
        instrumentalness: features.instrumentalness,
        key: features.key,
        liveness: features.liveness,
        loudness: features.loudness,
        mode: features.mode,
        speechiness: features.speechiness,
        time_signature: features.time_signature,
        valence: features.valence,
    };
}
