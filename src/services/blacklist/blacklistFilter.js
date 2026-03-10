import Blacklist from "../../models/Blacklist.js";
import { genreIndexToName } from "../../config/genres.js";

// Threshold for a genre to be considered "blocked" if it is not the absolute dominant genre
const GENRE_BLOCK_THRESHOLD = 0.4;

/**
 * Retrieves the blacklist for a given user and organizes it by type.
 * @param {String} userId - The user's ID
 * @returns {Promise<{blockedTracks: String[], blockedArtists: String[], blockedGenres: String[]}>}
 */
export async function getBlacklistFilters(userId) {
    if (!userId) {
        return { blockedTracks: [], blockedArtists: [], blockedGenres: [] };
    }

    const blacklist = await Blacklist.findOne({ userId }).lean();
    if (!blacklist || !blacklist.entries) {
        return { blockedTracks: [], blockedArtists: [], blockedGenres: [] };
    }

    const blockedTracks = [];
    const blockedArtists = [];
    const blockedGenres = [];

    for (const entry of blacklist.entries) {
        if (entry.type === "track") blockedTracks.push(entry.value);
        else if (entry.type === "artist") blockedArtists.push(entry.value);
        else if (entry.type === "genre") blockedGenres.push(entry.value);
    }

    return { blockedTracks, blockedArtists, blockedGenres };
}

/**
 * Determines whether a track's genre vector triggers a blacklist block.
 * A track is blocked if its most dominant genre is in the blocked list,
 * OR if any of its genres in the vector >= 0.4 is in the blocked list.
 * 
 * @param {Number[]} genreVector - The genre vector array of the track
 * @param {String[]} blockedGenres - Array of blocked genre names
 * @returns {Boolean} - true if the track should be blocked, false otherwise
 */
export function isGenreBlocked(genreVector, blockedGenres) {
    if (!blockedGenres || blockedGenres.length === 0) return false;
    if (!Array.isArray(genreVector) || genreVector.length === 0) return false;

    let maxScore = -1;
    let dominantIndex = -1;

    for (let i = 0; i < genreVector.length; i++) {
        const score = genreVector[i];

        // Check threshold condition
        if (score >= GENRE_BLOCK_THRESHOLD) {
            const genreName = genreIndexToName(i);
            if (genreName && blockedGenres.includes(genreName)) {
                return true;
            }
        }

        // Keep track of the dominant genre
        if (score > maxScore) {
            maxScore = score;
            dominantIndex = i;
        }
    }

    // Check dominant genre condition (even if it's below the threshold)
    if (dominantIndex !== -1) {
        const dominantGenreName = genreIndexToName(dominantIndex);
        if (dominantGenreName && blockedGenres.includes(dominantGenreName)) {
            return true;
        }
    }

    return false;
}
