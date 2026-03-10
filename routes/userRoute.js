import express from "express";
import { faker } from "@faker-js/faker";
import User from "../models/userModel.js";
import { upload } from "../middleware/multerSetup.js";

const router = express.Router();

//options for collection
router.options("/", (req, res) => {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.sendStatus(204);
});

router.options("/:id", (req, res) => {
    res.setHeader("Allow", "GET, OPTIONS, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.sendStatus(204);
});

//get all users
router.get("/",  async (req, res) => {
    const user =await User.find();
    const userCollection = {
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
    res.json(userCollection);
});

//post create new user (accept multipart/form-data)
router.post("/", upload.single('image'), async (req, res) => {
    // Multer populates req.body (string fields) and req.file (file)
    console.log('POST /users content-type:', req.headers['content-type']);
    console.log('POST /users has req.file:', !!req.file);
    console.log('POST /users req.body:', req.body);
    const body = req.body || {};
    const { username, email, password, role, spotifyId, spotify_id } = body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: "Missing required fields: username, email, password" });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: "Username already exists" });
        }

        const userData = {
            username,
            email,
            password,
            role: role || "user",
            spotifyId: spotifyId || spotify_id
        };

        if (req.file) {
            userData.image = {
                data: req.file.buffer,
                contentType: req.file.mimetype,
                filename: req.file.originalname,
                mimetype: req.file.mimetype
            };
        }

        const user = new User(userData);

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

//seed database
router.post("/seed", async (req, res) => {
    try {
        await User.deleteMany({});
        const amount = req.body?.amount ?? 10;

        const users = [];
        for (let i = 0; i < amount; i++) {
            users.push({
                username: faker.internet.displayName(),
                email: faker.internet.email(),
                password: faker.internet.password(),
                role: faker.helpers.arrayElement(["user", "admin"]),
                spotify_id: faker.string.alphanumeric(10),
                status: faker.helpers.arrayElement(["active", "warned", "banned"])
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

router.put("/:id", upload.single('image'), async (req, res) => {
    const userId = req.params.id;
    console.log('PUT /users/:id content-type:', req.headers['content-type']);
    console.log('PUT /users/:id has req.file:', !!req.file);
    console.log('PUT /users/:id req.body:', req.body);
    const body = req.body || {};
    const { username: username, email, role, status } = body;

    if (!username || !email || !role || !status) {
        return res.status(400).json({
            error: "Alle velden (username, email, role, status) zijn verplicht voor update"
        });
    }

    try {
        const updateData = { username, email, role, status };
        if (req.file) {
            updateData.image = { data: req.file.buffer, contentType: req.file.mimetype, filename: req.file.originalname, mimetype: req.file.mimetype };
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json(updatedUser);
    } catch (error) {
        res.status(404).send();
    }
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

router.get('/:id/image', async (req, res) => {
    const user = await User.findById(req.params.id).select('image');
    if (!user || !user.image || !user.image.data) return res.status(404).send();
    res.contentType(user.image.contentType || 'image/jpeg');
    res.send(user.image.data);
});


//forbidden methods for collection
router.all("/", (req, res, next) => {
    if (!["GET", "POST", "OPTIONS"].includes(req.method)) {
        res.setHeader("Allow", "GET, POST, OPTIONS");
        return res.sendStatus(405);
    }
    next();
});

router.delete("/:id", async (req, res) => {
    const userId = req.params.id;
    try {
        const deleted = await User.findByIdAndDelete(userId);
        if (!deleted) return res.status(404).send();
        res.status(204).send();
    } catch (e) {
        res.status(404).send();
    }
});

// Forbidden methods for detail

export default router;