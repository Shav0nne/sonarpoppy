import Friend from "../models/Friend.js";

export async function protect(req, res, next) {
    const userId = req.user.id;
    const friendId = req.params.friendId || req.params.requestId;

    try {
        // finding friendships based on ID
        const friendship = await Friend.FindByID({
            _id: friendId,
            $or: [
                { sender_user_id: userId },
                { receiver_user_id: userId }
            ]
        });

        if (!friendship) {
            return res.status(403).json({
                success: false, error: 'Forbidden: You are not part of this friendship'
            });
        }

        req.friendship = friendship; // Attach the friendship to the request for use in controllers
        next();
    } catch (error) {
        res.status(500).json({
            success: false, error: error.message
        });
    }
}