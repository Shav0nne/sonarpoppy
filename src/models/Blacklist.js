import mongoose from "mongoose";
import { GENRES } from "../config/genres.js";

const blacklistEntrySchema = new mongoose.Schema(
    {
        type: {
            type: String,
            required: true,
            enum: ["track", "artist", "genre"],
        },
        value: {
            type: String,
            required: true,
            validate: {
                validator(v) {
                    if (this.type === "genre") {
                        return GENRES.includes(v);
                    }
                    return true; // For tracks and artists, any string is fine (typically an ID or name)
                },
                message: (props) => `${props.value} is not a valid genre!`,
            },
        },
    },
    { _id: true, timestamps: true },
);

const blacklistSchema = new mongoose.Schema(
    {
        userId: {
            type: String, // Assuming userId is a String based on User.js or auth system
            required: true,
            unique: true,
            index: true,
        },
        entries: [blacklistEntrySchema],
    },
    { timestamps: true },
);

// Optional: you might want to prevent duplicate entries of the same type and value
// This is best handled in the route/service when adding, rather than DB schema array limits,
// although a unique array items validation could be written.

export default mongoose.model("Blacklist", blacklistSchema);
