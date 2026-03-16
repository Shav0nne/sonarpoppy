import mongoose from "mongoose";
import bcrypt from "bcrypt";

const friendSchema = new mongoose.Schema(
    {
        sender_user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
        receiver_user_id: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
        status: {type: String, enum: ["pending", "accepted", "rejected"], default: "pending"},
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
                        href: `${process.env.BASE_URI}/friends/${ret.id}`,
                    },
                    collection: {
                        href: `${process.env.BASE_URI}/friends`,
                    },
                };
                //remove internal fields before sending to client
                delete ret._id;
            },
        },
    }
);

//check if the friendship already exists between two users
friendSchema.index(
    { sender_user_id: 1, receiver_user_id: 1 },
    { unique: true }
);

const Friend = mongoose.model("Friend", friendSchema);

export default Friend;