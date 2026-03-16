const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
// Ensure this matches exactly what is registered in Spotify Dashboard
// Assuming standard port 3000 or the one from environment
const REDIRECT_URI = `${process.env.BASE_URI}/auth/spotify/callback`;

export function getAuthorizationUrl(state) {
    const scopes = [
        "user-read-email",
        "user-read-private",
        "streaming",
        "user-read-playback-state",
        "user-modify-playback-state",
        "user-library-read",
        "user-library-modify"
    ];

    const params = new URLSearchParams({
        response_type: "code",
        client_id: CLIENT_ID,
        scope: scopes.join(" "),
        redirect_uri: REDIRECT_URI,
        state: state,
    });

    return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCode(code) {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI,
    });

    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
        },
        body: body,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to exchange code: ${response.status} ${errorText}`);
    }

    return response.json();
}

export async function refreshAccessToken(refreshToken) {
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });

    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
        },
        body: body,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
    }

    return response.json();
}

