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

export function mapSimilarTracks(response) {
  const tracks = response.similartracks?.track;
  if (!tracks?.length) return [];

  return tracks
    .filter((t) => {
      const artist = t.artist?.name || t.artist?.["#text"];
      const match = Number(t.match);
      return artist && t.name && !isNaN(match) && match > 0;
    })
    .map((t) => ({
      artist: t.artist.name || t.artist["#text"],
      title: t.name,
      match: Number(t.match),
    }));
}

export function mapArtistInfo(response) {
  const artist = response.artist;

  const images = (artist.image ?? [])
    .filter((img) => img["#text"])
    .map((img) => ({ url: img["#text"], size: img.size }));

  return {
    name: artist.name,
    images,
    mbid: artist.mbid || null,
    url: artist.url,
  };
}

export function mapArtistSearch(response) {
  const artists = response.results?.artistmatches?.artist;
  if (!artists?.length) return [];

  return artists.filter((a) => a.name).map((a) => ({ name: a.name }));
}

export function mapSimilarArtists(response) {
  const artists = response.similarartists?.artist;
  if (!artists?.length) return [];

  return artists
    .filter((a) => {
      const match = Number(a.match);
      return a.name && !isNaN(match) && match > 0;
    })
    .map((a) => ({
      artist: a.name,
      match: Number(a.match),
    }));
}
