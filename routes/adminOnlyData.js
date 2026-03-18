import mongoose from "mongoose";
import {Router} from "express";
import {authenticateJWT} from "../src/middleware/authMiddleware.js";
import {ifAdmin} from "../src/middleware/onlyAdmin.js";

const router = Router();

router.get('/blacklist', authenticateJWT, ifAdmin, async (req, res) => {
    try {
        const db = mongoose.connection.db;

        // List collections to confirm the history collection exists in this DB
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        // Find candidate history collections related to blacklist (case-insensitive)
        const candidates = collectionNames.filter(name => /blacklist.*history/i.test(name));

        let chosen = null;
        let count = 0;
        let histories = [];

        if (candidates.length > 0) {
            // Choose the candidate with the largest document count (if multiple exist)
            let best = { name: null, count: -1 };
            for (const name of candidates) {
                const col = db.collection(name);
                let c = 0;
                try { c = await col.countDocuments(); } catch (e) { c = 0; }
                if (c > best.count) best = { name, count: c };
            }

            if (best.name) {
                chosen = best.name;
                count = best.count;
                const collection = db.collection(chosen);
                histories = await collection.find({}).sort({ t: -1 }).limit(50).toArray();
            }
        }

        return res.json({  items: histories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/genreslider', authenticateJWT, ifAdmin, async (req, res) => {
    try {
        const db = mongoose.connection.db;

        // List collections to confirm the history collection exists in this DB
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        // Find candidate history collections related to blacklist (case-insensitive)
        const candidates = collectionNames.filter(name => /genreslider.*history/i.test(name));

        let chosen = null;
        let count = 0;
        let histories = [];

        if (candidates.length > 0) {
            // Choose the candidate with the largest document count (if multiple exist)
            let best = { name: null, count: -1 };
            for (const name of candidates) {
                const col = db.collection(name);
                let c = 0;
                try { c = await col.countDocuments(); } catch (e) { c = 0; }
                if (c > best.count) best = { name, count: c };
            }

            if (best.name) {
                chosen = best.name;
                count = best.count;
                const collection = db.collection(chosen);
                histories = await collection.find({}).sort({ t: -1 }).limit(50).toArray();
            }
        }

        return res.json({  items: histories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/feedback', authenticateJWT, ifAdmin, async (req, res) => {
    try {
        const db = mongoose.connection.db;

        // List collections to confirm the history collection exists in this DB
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        // Find candidate history collections related to blacklist (case-insensitive)
        const candidates = collectionNames.filter(name => /feedback.*history/i.test(name));

        let chosen = null;
        let count = 0;
        let histories = [];

        if (candidates.length > 0) {
            // Choose the candidate with the largest document count (if multiple exist)
            let best = { name: null, count: -1 };
            for (const name of candidates) {
                const col = db.collection(name);
                let c = 0;
                try { c = await col.countDocuments(); } catch (e) { c = 0; }
                if (c > best.count) best = { name, count: c };
            }

            if (best.name) {
                chosen = best.name;
                count = best.count;
                const collection = db.collection(chosen);
                histories = await collection.find({}).sort({ t: -1 }).limit(50).toArray();
            }
        }

        return res.json({  items: histories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;