import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../src/models/User.js";
import {upload} from "../src/middleware/multerSetup.js";
import {authenticateJWT} from "../src/middleware/authMiddleware.js";
import {exchangeCode, getAuthorizationUrl, refreshAccessToken} from "../src/services/spotify/auth.js";

const router = express.Router();

// Options
router.options("/", (req, res) => {
    res.setHeader("Allow", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.sendStatus(204);
});

// POST /auth/signup
// Accept multipart/form-data so clients can upload a profile image under the field `image`
router.post("/signup", upload.single('image'), async (req, res) => {
    const {username, email, password, role} = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({message: "Missing required fields: username, email, password"});
    }

    try {
        const existing = await User.findOne({$or: [{username}, {email}]});
        if (existing) return res.status(409).json({message: "Username or email already exists"});

        // Build user data and include uploaded image if present
        const userData = {username, email, password, role: role || "user"};
        if (req.file) {
            userData.image = {
                data: req.file.buffer,
                contentType: req.file.mimetype
            };
        }

        // Let the model pre-save hook hash the password
        const user = new User(userData);
        await user.save();

        const id = user.id || (user._id ? user._id.toString() : undefined);

        res.status(201).json({
            id,
            username: user.username,
            email: user.email,
            role: user.role,
            imageUrl: user.image ? `${process.env.BASE_URI}/users/${user.id}/image` : null,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
            _links: {
                self: {
                    href: `${process.env.BASE_URI}/users/${user.id || (user._id ? user._id.toString() : "")}`,
                },
                collection: {href: `${process.env.BASE_URI}/users`},
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: "Server error"});
    }
});

// POST /auth/login
router.post("/login", async (req, res) => {
    const {username, password} = req.body;
    if (!username || !password) {
        return res.status(400).json({message: "Missing username or password"});
    }

    try {
        const user = await User.findOne({username}).select("+password +role");
        if (!user) return res.status(401).json({message: "Invalid credentials"});

        // Compare supplied password with hashed password stored in DB
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({message: "Invalid credentials"});

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET not set");
            return res.status(500).json({message: "Server not configured for authentication"});
        }

        const payload = {sub: user._id.toString(), role: user.role};
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || "1h",
        });

        res.json({
            token,
            tokenType: "Bearer",
            expiresIn: process.env.JWT_EXPIRES_IN || "1h",
            user: {
                id: user._id.toString(),
                username: user.username,
                role: user.role,
                hasCompletedOnboarding: user.hasCompletedOnboarding,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: "Server error"});
    }
});

// GET /auth/me
router.get("/me", authenticateJWT, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({message: "User not found"});

        res.json({
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            role: user.role,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
            imageUrl: user.image ? `${process.env.BASE_URI}/users/${user.id}/image` : null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: "Server error"});
    }
});

// GET /auth/spotify/link
// Returns the Spotify authorization URL or redirects if token is provided
// We use a query param 'token' (JWT) to identify the user because this is often
// triggered via a simple link navigation or window.open where headers are hard to set.
router.get("/spotify/link", async (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(401).send("Missing token query parameter");

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const userId = payload.sub;

        // Create a state token containing the userId. This prevents CSRF and persists user context.
        // It's short-lived (5 mins).
        const state = jwt.sign({userId, nonce: Math.random().toString(36)}, process.env.JWT_SECRET, {expiresIn: '5m'});

        const url = getAuthorizationUrl(state);
        res.redirect(url);
    } catch (err) {
        console.error("Spotify Link Error:", err);
        return res.status(401).send("Invalid or expired token");
    }
});

// GET /auth/spotify/callback
// Handles the callback from Spotify
router.get("/spotify/callback", async (req, res) => {
    const {code, state, error} = req.query;

    if (error) {
        return res.redirect(`/spotify-player.html?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
        return res.redirect(`/spotify-player.html?error=missing_params`);
    }

    try {
        // Verify state to recover userId
        const decodedState = jwt.verify(state, process.env.JWT_SECRET);
        const userId = decodedState.userId;

        // Exchange code for tokens
        const data = await exchangeCode(code);

        // data = { access_token, token_type, scope, expires_in, refresh_token }
        const {access_token, refresh_token, expires_in} = data;

        const expiresAt = new Date(Date.now() + expires_in * 1000);

        // Update user
        await User.findByIdAndUpdate(userId, {
            spotifyAccessToken: access_token,
            spotifyRefreshToken: refresh_token,
            spotifyTokenExpiry: expiresAt,
        });

        // Redirect to player with success flag
        res.redirect(`/spotify-player.html?connected=true`);
    } catch (err) {
        console.error("Spotify Callback Error:", err);
        return res.redirect(`/spotify-player.html?error=auth_failed`);
    }
});

// GET /auth/spotify/token
// Returns the valid access token for the logged-in user
router.get("/spotify/token", authenticateJWT, async (req, res) => {
    try {
        // Need to explicitly select the fields as they are marked select: false in schema
        const user = await User.findById(req.user.id).select("+spotifyAccessToken +spotifyRefreshToken +spotifyTokenExpiry");

        if (!user || !user.spotifyAccessToken) {
            return res.status(404).json({message: "Spotify not connected"});
        }

        // Check if token is expired or expiring soon (within 5 minutes)
        const now = new Date();
        const expiryBuffer = 5 * 60 * 1000;

        if (user.spotifyTokenExpiry && (new Date(user.spotifyTokenExpiry).getTime() - now.getTime() < expiryBuffer)) {
            // Need refresh
            if (!user.spotifyRefreshToken) {
                return res.status(401).json({message: "Token expired and no refresh token available"});
            }

            try {
                const data = await refreshAccessToken(user.spotifyRefreshToken);
                // data might contain new access_token, expires_in, and sometimes a new refresh_token

                user.spotifyAccessToken = data.access_token;
                if (data.refresh_token) {
                    user.spotifyRefreshToken = data.refresh_token;
                }
                user.spotifyTokenExpiry = new Date(Date.now() + data.expires_in * 1000);

                await user.save();
            } catch (refreshErr) {
                console.error("Token refresh failed", refreshErr);
                return res.status(401).json({message: "Failed to refresh token"});
            }
        }

        res.json({accessToken: user.spotifyAccessToken});
    } catch (err) {
        console.error(err);
        res.status(500).json({error: "Server error"});
    }
});

// Method guard
router.all("/", (req, res, next) => {
    if (!["POST", "OPTIONS"].includes(req.method)) {
        res.setHeader("Allow", "POST, OPTIONS");
        return res.sendStatus(405);
    }
    next();
});

export default router;
