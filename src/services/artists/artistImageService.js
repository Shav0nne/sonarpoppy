import ArtistImage from "../../models/ArtistImage.js";

const DEFAULT_TTL_DAYS = 30;

function isStale(fetchedAt, ttlDays) {
  const age = Date.now() - fetchedAt.getTime();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  return age > ttlMs;
}

export async function getArtistImage(artistName, lastfmClient, options = {}) {
  const { db = ArtistImage, ttlDays = DEFAULT_TTL_DAYS } = options;
  const normalizedName = artistName.toLowerCase();

  const cached = await db.findOne({ artist: normalizedName });

  if (cached && !isStale(cached.fetchedAt, ttlDays)) {
    return cached;
  }

  let artistInfo;
  try {
    artistInfo = await lastfmClient.getArtistInfo(artistName);
  } catch (err) {
    if (err.name === "LastfmNotFoundError") return null;
    throw err;
  }

  const now = new Date();
  const updated = await db.findOneAndUpdate(
    { artist: normalizedName },
    {
      $set: {
        artist: normalizedName,
        images: artistInfo.images,
        fetchedAt: now,
      },
    },
    { upsert: true, new: true },
  );

  return updated;
}
