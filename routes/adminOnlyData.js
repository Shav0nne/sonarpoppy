import mongooseHistory from "mongoose-history";
import mongoose from "mongoose";
import { Router } from "express";

const router = Router();

router.get('/history', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection('blacklist_history');

        // Query it directly
        const histories = await collection.find({})
            .sort({ t: -1 })
            .limit(50)
            .toArray();

        res.json(histories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;