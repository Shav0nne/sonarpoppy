import User from "../models/userModel.js";
import { faker } from "@faker-js/faker";


// options for collection
router.options("/", (req, res) => {
    res.setHeader("Allow", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.sendStatus(204);
});

// POST /setup - initialize app (stub)
// Example: create an admin user if no users exist

//POST here
router.post("/", async (req, res) => {
    const { username, email, password, role, spotify_id: spotify_id } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: "Missing required fields: username, email, password" });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: "Username already exists" });
        }

        const user = new User({
            username,
            email,
            password,
            role: role || "user",
            spotify_id: spotify_id
        });

        await user.save();

        res.status(201).json({
            username: user.username,
            email: user.email,
            role: user.role,
            spotify_id: user.spotify_id,
            _links: {
                self: {
                    href: `${process.env.BASE_URI}/users/${user._id}`,
                },
                collection: {
                    href: `${process.env.BASE_URI}/users`,
                },
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});
// forbidden methods for this route
router.all("/", (req, res, next) => {
    if (!["POST", "OPTIONS"].includes(req.method)) {
        res.setHeader("Allow", "POST, OPTIONS");
        return res.sendStatus(405);
    }
    next();
});

export default router;
import express from "express";

const router = express.Router();

// options for collection
router.options("/", (req, res) => {
    res.setHeader("Allow", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.sendStatus(204);
});

// POST /login - authenticate user (stub)
router.post("/", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Missing username or password" });
    }

    // TODO: implement real authentication (verify password, issue token)
    // This is a placeholder response until auth is implemented.
    res.json({ message: "Login successful (stub)", username });
});

// forbidden methods for this route
router.all("/", (req, res, next) => {
    if (!["POST", "OPTIONS"].includes(req.method)) {
        res.setHeader("Allow", "POST, OPTIONS");
        return res.sendStatus(405);
    }
    next();
});


