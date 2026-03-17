import {Router} from "express";
import Track from "../src/models/Track.js";
import {createLastfmClient} from "../src/services/lastfm/client.js";
import {createSpotifyClient} from "../src/services/spotify/client.js";
import {ingestBatch, ingestTrack} from "../src/services/ingestion/ingest.js";
import {enrichTracks} from "../src/services/spotify/enrichSpotify.js";
import {enrichCfData} from "../src/services/cf/enrichCf.js";
import {enrichTracksWithDeezer} from "../src/services/deezer/enrichDeezer.js";

const router = Router();

const client = createLastfmClient({apiKey: process.env.LASTFM_API_KEY});

const spotifyClient =
    process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
        ? createSpotifyClient({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        })
        : null;

router.get("/search", async (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 2) {
    return res.status(400).json({ error: "Query must be at least 2 characters" });
  }

  const regex = new RegExp(q, "i");
  const tracks = await Track.find({
    $or: [{ title: regex }, { artist: regex }],
  })
    .limit(10)
    .lean();

  res.json({
    results: tracks.map((t) => ({ title: t.title, artist: t.artist })),
  });
});

router.get("/", async (req, res) => {
    const tracks = await Track.find().lean();
    res.json({
        items: tracks,
        _links: {
            self: {href: "/api/tracks"},
            ingest: {href: "/api/tracks/ingest"},
        },
    });
});

router.post("/ingest", async (req, res) => {
    const {artist, title, force} = req.body;
    if (!artist || !title) {
        return res.status(400).json({error: "artist and title are required"});
    }

    const result = await ingestTrack(client, artist, title, {force});
    const status = result.status === "created" ? 201 : 200;

    res.status(status).json({
        ...result,
        _links: {
            self: {href: "/api/tracks/ingest"},
            tracks: {href: "/api/tracks"},
        },
    });
});

router.post("/ingest-batch", async (req, res) => {
    const {tracks, force} = req.body;
    if (!Array.isArray(tracks)) {
        return res.status(400).json({error: "tracks array is required"});
    }

    const result = await ingestBatch(client, tracks, {force});

    res.json({
        ...result,
        _links: {
            self: {href: "/api/tracks/ingest-batch"},
            tracks: {href: "/api/tracks"},
        },
    });
});

router.post("/enrich-spotify", async (req, res) => {
    try {
        if (!spotifyClient) {
            return res.status(503).json({error: "Spotify credentials not configured"});
        }

        const {batchSize} = req.body || {};
        const result = await enrichTracks(spotifyClient, {batchSize});

        res.json({
            ...result,
            _links: {
                self: {href: "/api/tracks/enrich-spotify"},
                tracks: {href: "/api/tracks"},
            },
        });
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

router.post("/enrich-cf", async (req, res) => {
    try {
        const {batchSize} = req.body || {};
        const result = await enrichCfData(client, {batchSize});

        res.json({
            ...result,
            _links: {
                self: {href: "/api/tracks/enrich-cf"},
                tracks: {href: "/api/tracks"},
            },
        });
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

router.post("/enrich-deezer", async (req, res) => {
    try {
        const {batchSize} = req.body || {};
        const result = await enrichTracksWithDeezer({batchSize});

        res.json({
            ...result,
            _links: {
                self: {href: "/api/tracks/enrich-deezer"},
                tracks: {href: "/api/tracks"},
            },
        });
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

export default router;
