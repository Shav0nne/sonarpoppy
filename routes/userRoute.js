import express from "express";
import { faker } from "@faker-js/faker";
import User from "../models/userModel.js";

const router = express.Router();

//options for collection
router.options("/", (req, res) => {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.sendStatus(204);
});

//get all users
router.get("/",  async (req, res) => {
    const user =await User.find({},'-password -__v');
    const trainCollection = {
        items: user,
        _links: {
            self: {
                href: process.env.BASE_URI,
            },
            collection: {
                href: process.env.BASE_URI,
            },
        }


    }
    res.json(trainCollection);
});

//post create new user
router.post("/", async (req, res) => {
    const { username, email, password, role, spotifyId } = req.body;

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
            spotifyId
        });

        await user.save();

        res.status(201).json({
            username: user.username,
            email: user.email,
            role: user.role,
            spotifyId: user.spotifyId,
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

//seed database
router.post("/seed", async (req, res) => {
    try {
        await User.deleteMany({});
        const amount = req.body.amount || 10;

        const users = [];
        for (let i = 0; i < amount; i++) {
            users.push({
                username: faker.internet.displayName(),
                email: faker.internet.email(),
                password: faker.internet.password(),
                role: faker.helpers.arrayElement(["user", "admin"]),
                spotifyId: faker.string.alphanumeric(10),
            });
        }

        const result = await User.insertMany(users);
        res.status(201).json({
            message: `Database seeded with ${result.length} users`,
            count: result.length
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

// router.put("/:id", async (req, res) => {
//     const userId = req.params.id;
//     const { username, email, password, role, spotify_id } = req.body;
//
//     // Validate required fields (adjust based on your requirements)
//     if (!username || !email || !role) {
//         return res.status(400).json({
//             error: "Required fields missing. Username, email, and role are required for update"
//         });
//     }
//
//     const updateData = {
//         username,
//         email,
//         role
//     };
//
//     const updatedUser = await User.findByIdAndUpdate(
//         userId,
//         updateData,
//         {
//             new: true,           // Return updated document
//             runValidators: true,  // Run schema validators
//             context: 'query'      // Important for certain validators
//         }
//     ).select('-__v'); // Optionally exclude version field
//
//     if (!updatedUser) {
//         return res.status(404).json({ error: "User not found" });
//     }});
//options for detail
router.options("/:id", (req, res) => {
    res.setHeader("Allow", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.sendStatus(204);
});

//get user by id
router.get("/:id", async (req, res) => {
    const userId = req.params.id;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).send(); // not found after deletion
        res.json(user);
    } catch (e) {res.status(404).send();
    }
});

//forbidden methods for collection
router.all("/", (req, res, next) => {
    if (!["GET", "POST", "OPTIONS"].includes(req.method)) {
        res.setHeader("Allow", "GET, POST, OPTIONS");
        return res.sendStatus(405);
    }
    next();
});

// Forbidden methods for detail

export default router;