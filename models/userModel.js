import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true },
        email: { type: String, required: true },
        password: { type: String, required: true },
        role: { type: String, enum: ["user", "admin"], default: "user" },
        spotifyId: { type: String },
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            versionKey: false,
            transform: (doc, ret) => {
                ret._links = {
                    self: {
                        href: `${process.env.BASE_URI}${ret._id}`,
                    },
                    collection: {
                        href: `${process.env.BASE_URI}`,
                    },
                };

                delete ret._id;
            },
        },
    }
);

const User = mongoose.model("User", userSchema);

export default User;