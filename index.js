import express from "express";
import mongoose from "mongoose";
import apiRouter from "./routes/index.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// CORS — preflight + headers voor React frontend
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, X-API-Key");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

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
