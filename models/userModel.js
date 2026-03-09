import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true },
        email: { type: String, required: true },
        password: {
            type: String,
            required: true,
            // validate: {
            //     validator: function (value) {
            //         // if (typeof value !== 'string') return false;
            //         // if (value.length < 8) {
            //         //     return false;
            //         // }
            //         // if (!/[0-9]/.test(value)) {
            //         //     return false;
            //         // }
            //         // if (!/[@$!%*?&]/.test(value)) {
            //         //     return false;
            //         // }
            //         return true;
            //     },
            //     message: 'Password must be at least 8 characters and contain a number and a special character (@, $, !, %, *, ?, &).'
            // }
        },
        role: { type: String, enum: ["user", "admin"], default: "user" },
        spotifyId: { type: String },
        status: { type: String, enum: ["active", "warned", "banned"], default: "active" },
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            versionKey: false,
            transform: (doc, ret) => {
                // expose `id` as a string and include HATEOAS links
                ret.id = ret._id ? ret._id.toString() : undefined;

                ret._links = {
                    self: {
                        href: `${process.env.BASE_URI}/users/${ret.id}`,
                    },
                    collection: {
                        href: `${process.env.BASE_URI}/users`,
                    },
                };

                delete ret._id;
            },
        },
    }
);

const User = mongoose.model("User", userSchema);

export default User;