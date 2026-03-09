export class SpotifyApiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = "SpotifyApiError";
        this.status = status;
    }
}

export class SpotifyRateLimitError extends SpotifyApiError {
    constructor(retryAfter) {
        super("Spotify API rate limit exceeded", 429);
        this.name = "SpotifyRateLimitError";
        this.retryAfter = retryAfter;
    }
}

export class SpotifyNotFoundError extends SpotifyApiError {
    constructor(message = "Track not found on Spotify") {
        super(message, 404);
        this.name = "SpotifyNotFoundError";
    }
}
