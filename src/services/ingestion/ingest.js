import Track from "../../models/Track.js";
import {createVector} from "../../utils/genreVector.js";

const SPARSE_GENRE_THRESHOLD = 3;

/**
 * Counts the number of non-zero entries in a genre vector (mapped genres).
 */
function countMappedGenres(vector) {
    return vector.filter((v) => v > 0).length;
}

/**
 * Fetches tags for a track, with artist fallback when track tags yield
 * fewer than SPARSE_GENRE_THRESHOLD mapped genres.
 *
 * Returns an array of tag name strings.
 */
async function fetchTagsWithFallback(client, artist, title) {
    // 1. Try track-level top tags first
    const trackTopTags = await client.getTrackTopTags(artist, title);
    const trackTagNames = trackTopTags.map((t) => t.name);
    const trackVector = createVector(trackTagNames);

    if (countMappedGenres(trackVector) >= SPARSE_GENRE_THRESHOLD) {
        return trackTagNames;
    }

    // 2. Fallback: artist-level top tags
    const artistTopTags = await client.getArtistTopTags(artist);
    const artistTagNames = artistTopTags.map((t) => t.name);

    // Merge: track tags first, then artist tags (no duplicates)
    const seen = new Set(trackTagNames.map((t) => t.toLowerCase()));
    const merged = [...trackTagNames];
    for (const tag of artistTagNames) {
        if (!seen.has(tag.toLowerCase())) {
            merged.push(tag);
            seen.add(tag.toLowerCase());
        }
    }

    return merged;
}

/**
 * Ingests a single track.
 *
 * REQ-001: Fetches track info + tags from Last.fm, computes genreVector, saves to MongoDB.
 * REQ-002: Falls back to artist tags when track tags are sparse (<3 mapped genres).
 * REQ-003: Skips existing tracks unless force=true.
 *
 * @param {object} client  - Last.fm client (getTrackInfo, getTrackTopTags, getArtistTopTags)
 * @param {string} artist
 * @param {string} title
 * @param {object} [opts]
 * @param {boolean} [opts.force=false]  - overwrite existing track
 * @returns {{ status: 'saved'|'updated'|'skipped', track?: object, error?: Error }}
 */
export async function ingestTrack(client, artist, title, opts = {}) {
    const {force = false} = opts;

    try {
        // REQ-003: skip check
        const existing = await Track.findOne({artist, title});
        if (existing && !force) {
            return {status: "skipped", track: existing};
        }

        // REQ-001: fetch track info from Last.fm
        const trackInfo = await client.getTrackInfo(artist, title);

        // REQ-002 + REQ-006: fetch tags with artist fallback, build genreVector
        const tags = await fetchTagsWithFallback(client, trackInfo.artist, trackInfo.title);
        const genreVector = createVector(tags);

        const doc = {
            title: trackInfo.title,
            artist: trackInfo.artist,
            album: trackInfo.album ?? undefined,
            duration: trackInfo.duration ?? undefined,
            genreVector,
            lastfmUrl: trackInfo.lastfmUrl ?? undefined,
            lastfmTags: tags,
            mbid: trackInfo.mbid ?? undefined,
            imageUrl: trackInfo.imageUrl ?? undefined,
        };

        if (existing && force) {
            // Update existing document
            Object.assign(existing, doc);
            await existing.save();
            return {status: "updated", track: existing};
        }

        const track = await Track.create(doc);
        return {status: "saved", track};
    } catch (err) {
        return {status: "error", error: err};
    }
}

/**
 * Ingests multiple tracks sequentially.
 *
 * REQ-004: Processes an array of { artist, title } objects one by one.
 * REQ-005: Graceful error handling — never throws; failed tracks get status "error".
 *
 * @param {object} client
 * @param {Array<{ artist: string, title: string }>} tracks
 * @param {object} [opts]
 * @param {boolean} [opts.force=false]
 * @returns {Promise<Array<{ artist, title, status, track?, error? }>>}
 */
export async function ingestBatch(client, tracks, opts = {}) {
    const results = [];

    for (const {artist, title} of tracks) {
        const result = await ingestTrack(client, artist, title, opts);
        results.push({artist, title, ...result});
    }

    return results;
}

