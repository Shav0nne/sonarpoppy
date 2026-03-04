import express from "express";
import mongoose from "mongoose";
import router from "./routes/userRoute.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//CORS MIDDLEWARE
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
});

//accept header middleware
app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
        return next();
    }
    const accept = req.headers.accept;

    if (!accept || !accept.includes("application/json")) {
        return res.status(406).json({
            message: "Only application/json is allowed in Accept header"
        });
    }
    next();
});

// Routes
app.use("/", router);

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
    process.exit(1);
}

app.listen(process.env.EXPRESS_PORT, () => {
    console.log(`Server is listening on port ${process.env.EXPRESS_PORT}`);
});
