import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true },
        email: { type: String, required: true },
        password: {
            type: String,
            required: true,
            select: false,
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
                // expose `id` as a string
                ret.id = ret._id ? ret._id.toString() : undefined;

                ret._links = {
                    self: {
                        href: `${process.env.BASE_URI}/users/${ret.id}`,
                    },
                    collection: {
                        href: `${process.env.BASE_URI}/users`,
                    },
                };

                // remove internal fields before sending to client
                delete ret._id;
                delete ret.password;
            },
        },
    }
);

// Pre-save hook: hash password if modified
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;