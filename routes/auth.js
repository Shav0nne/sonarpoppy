import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../src/models/User.js";
import { authenticateJWT } from "../src/middleware/authMiddleware.js";

const router = express.Router();

// Options
router.options("/", (req, res) => {
  res.setHeader("Allow", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.sendStatus(204);
});

// POST /auth/signup
router.post("/signup", async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: "Missing required fields: username, email, password" });
  }

  try {
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.status(409).json({ message: "Username or email already exists" });

    // Let the model pre-save hook hash the password
    const user = new User({ username, email, password, role: role || "user" });
    await user.save();

    res.status(201).json({
      id: user.id || (user._id ? user._id.toString() : undefined),
      username: user.username,
      email: user.email,
      role: user.role,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      _links: {
        self: {
          href: `${process.env.BASE_URI}/users/${user.id || (user._id ? user._id.toString() : "")}`,
        },
        collection: { href: `${process.env.BASE_URI}/users` },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Missing username or password" });
  }

  try {
    const user = await User.findOne({ username }).select("+password +role");
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    // Compare supplied password with hashed password stored in DB
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET not set");
      return res.status(500).json({ message: "Server not configured for authentication" });
    }

    const payload = { sub: user._id.toString(), role: user.role };
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
    res.status(500).json({ error: "Server error" });
  }
});

// GET /auth/me
router.get("/me", authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
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
