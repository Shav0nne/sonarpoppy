export function mapSpotifyTrack(item) {
  if (!item) return null;

  return {
    spotifyId: item.id,
    spotifyUri: item.uri,
    duration: Math.round(item.duration_ms / 1000) || null,
    explicit: Boolean(item.explicit),
    albumImages:
      item.album?.images?.map((img) => ({
        url: img.url,
        height: img.height,
        width: img.width,
      })) || [],
  };
}
