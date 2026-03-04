export function mapTrackInfo(response) {
  const track = response.track;

  const duration = Number(track.duration);
  const tags = track.toptags?.tag?.map((t) => t.name) ?? [];
  const images = track.image ?? [];
  const bestImage = [...images].reverse().find((img) => img["#text"]) ?? null;

  return {
    title: track.name,
    artist: track.artist.name,
    album: track.album?.title ?? track.album?.["#text"] ?? null,
    duration: duration > 0 ? Math.round(duration / 1000) : null,
    tags,
    lastfmUrl: track.url,
    mbid: track.mbid || null,
    imageUrl: bestImage ? bestImage["#text"] : null,
  };
}

export function mapTopTags(response) {
  const tags = response.toptags?.tag;
  if (!tags?.length) return [];

  return tags
    .map((t) => ({ name: t.name, count: Number(t.count) }))
    .sort((a, b) => b.count - a.count);
}
