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
    const users = await User.find();
    const items = users.map(u => {
        const id = u.id || (u._id ? u._id.toString() : undefined);
        const hasImage = !!(u.image && (u.image.data || u.image._id));
        return {
            id,
            username: u.username,
            email: u.email,
            role: u.role,
            spotifyId: u.spotifyId,
            status: u.status,
            imageUrl: hasImage ? `${process.env.BASE_URI}/users/${id}/image` : null,
            _links: {
                self: { href: `${process.env.BASE_URI}/users/${id}` },
                collection: { href: `${process.env.BASE_URI}/users` }
            }
        };
    });

    res.json({ items, _links: { self: { href: `${process.env.BASE_URI}/users` } } });
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

        const id = user.id || (user._id ? user._id.toString() : undefined);
        res.status(201).json({
            id,
            username: user.username,
            email: user.email,
            role: user.role,
            spotifyId: user.spotifyId,
            imageUrl: user.image ? `${process.env.BASE_URI}/users/${id}/image` : null,
            _links: {
                self: { href: `${process.env.BASE_URI}/users/${id}` },
                collection: { href: `${process.env.BASE_URI}/users` }
            }
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

        // sanitize response: don't include binary image buffer
        const id = updatedUser.id || (updatedUser._id ? updatedUser._id.toString() : undefined);
        res.status(200).json({
            id,
            username: updatedUser.username,
            email: updatedUser.email,
            role: updatedUser.role,
            status: updatedUser.status,
            imageUrl: updatedUser.image ? `${process.env.BASE_URI}/users/${id}/image` : null,
            _links: { self: { href: `${process.env.BASE_URI}/users/${id}` } }
        });
     } catch (error) {
         res.status(404).send();
     }
});

//get user by id
router.get("/:id", async (req, res) => {
    const userId = req.params.id;
    try {
        const user = await User.findById(userId).select('+image');
        if (!user) return res.status(404).send();

        const id = user.id || (user._id ? user._id.toString() : undefined);
        const hasImage = !!(user.image && user.image.data);

        // If client explicitly requests base64 embedding, return data URL
        if (req.query.embed === 'base64' && hasImage) {
            const b64 = user.image.data.toString('base64');
            const mime = user.image.contentType || user.image.mimetype || 'image/jpeg';
            return res.json({ id, username: user.username, email: user.email, role: user.role, image: `data:${mime};base64,${b64}` });
        }

        // Otherwise return metadata + imageUrl link
        res.json({
            id,
            username: user.username,
            email: user.email,
            role: user.role,
            status: user.status,
            imageUrl: hasImage ? `${process.env.BASE_URI}/users/${id}/image` : null,
            _links: { self: { href: `${process.env.BASE_URI}/users/${id}` } }
        });
    } catch (e) { res.status(404).send(); }
});

router.get('/:id/image', async (req, res) => {
    const user = await User.findById(req.params.id).select('image');
    if (!user || !user.image || !user.image.data) return res.status(404).send();
    const mime = user.image.contentType || user.image.mimetype || 'image/jpeg';
    res.setHeader('Content-Type', mime);
    // Cache for 24 hours by default
    res.setHeader('Cache-Control', 'public, max-age=86400');
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