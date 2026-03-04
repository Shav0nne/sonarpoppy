import express from "express";
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
router.get("/", async (req, res) => {
    try {
        const users = await User.find();

        const items = users.map((user) => ({
            username: user.username,
            email: user.email,
            role: user.role,
            spotifyId: user.spotifyId,
            _links: {
                self: {
                    href: `${process.env.BASE_URI}/${user._id}`,
                },
                collection: {
                    href: process.env.BASE_URI,
                },
            },
        }));

        res.json({
            items: items,
            _links: {
                self: {
                    href: process.env.BASE_URI,
                },
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
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

        const user = new User({username, email, password, role: role || "user", spotifyId
        });

        await user.save();

        res.status(201).json({
            username: user.username,
            email: user.email,
            role: user.role,
            spotifyId: user.spotifyId,
            _links: {
                self: {
                    href: `${process.env.BASE_URI}/${user._id}`,
                },
                collection: {
                    href: process.env.BASE_URI,
                },
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});


//seed database
// router.post("/seed", async (req, res) => {
//     try {
//         await User.deleteMany({});
//         const amount = req.body.amount || 10;
//
//         const User = [];
//         for (let i = 0; i < amount; i++) {
//             characters.push({
//                 username: faker.person.fullName(),
//             });
//         }
//
//         await User.insertMany(characters);
//         res.status(201).json({ message: `Database seeded with ${amount} characters` });
//     } catch (error) {
//         res.status(500).json({ error: "Server error" });
//     }
// });

//options for detail
router.options("/:id", (req, res) => {
    res.setHeader("Allow", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.sendStatus(204);
});

//get user by id
router.get("/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.sendStatus(404);

        const lastModified = user.updatedAt.toUTCString();
        res.setHeader("Last-Modified", lastModified);

        const ifModifiedSince = req.headers["if-modified-since"];
        if (ifModifiedSince && new Date(ifModifiedSince) >= user.updatedAt) {
            return res.sendStatus(304);
        }

        res.json({
            username: user.username,
            email: user.email,
            role: user.role,
            spotifyId: user.spotifyId,
            _links: {
                self: {
                    href: `${process.env.BASE_URI}/${user._id}`,
                },
                collection: {
                    href: process.env.BASE_URI,
                },
            },
        });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
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
router.all("/:id", (req, res, next) => {
    if (!["GET", "OPTIONS"].includes(req.method)) {
        res.setHeader("Allow", "GET, OPTIONS");
        return res.sendStatus(405);
    }
    next();
});

export default router;