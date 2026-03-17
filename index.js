import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import apiRouter from "./routes/index.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// CORS — preflight + headers voor React frontend
app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Content-Type', 'Authorization', 'X-API-Key'],
    }
));

// Routes — alles via /api/v1
// Accept header check alleen op API routes (niet op statische bestanden)
app.use(
  "/api/v1",
  (req, res, next) => {
    const accept = req.headers.accept;
    if (!accept || (!accept.includes("application/json") && !accept.includes("*/*"))) {
      return res.status(406).json({
        message: "Only application/json is allowed in Accept header",
      });
    }
    next();
  },
  apiRouter,
);

// Database connectie
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not defined in environment variables");
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");
} catch (error) {
  console.error("MongoDB connection error", error);
}

app.listen(process.env.EXPRESS_PORT, () => {
  console.log(`Server is listening on port ${process.env.EXPRESS_PORT}`);
});
