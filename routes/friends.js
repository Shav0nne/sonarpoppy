import express from 'express';
import Friend from '../src/models/Friend.js';
import User from '../src/models/User.js';
import { protect as friendProtect } from '../src/middleware/friendMiddleware.js';

const router = express.Router();

// OPTIONS for collection
router.options("/", (req, res) => {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    res.sendStatus(204);
});

// OPTIONS for single resource
router.options("/:id", (req, res) => {
    res.setHeader("Allow", "GET, OPTIONS, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    res.sendStatus(204);
});

// GET /api/friends - Get all friends of the authenticated user
router.get('/', friendProtect, async (req, res) => {
    try {
        const userId = req.user.id;

        // Find all accepted friendships where the user is involved
        const friendships = await Friend.find({
            $or: [
                { sender_user_id: userId, status: 'accepted' },
                { receiver_user_id: userId, status: 'accepted' }
            ]
        }).populate('sender_user_id receiver_user_id', 'username email image');

        // Format the response for each friendship
        const friends = friendships.map(friendship => {
            const isSender = friendship.sender_user_id._id.toString() === userId;
            const friend = isSender ? friendship.receiver_user_id : friendship.sender_user_id;

            return {
                id: friend._id,
                username: friend.username,
                email: friend.email,
                image: friend.image,
                friendshipId: friendship._id,
                since: friendship.accepted_at || friendship.updatedAt,
                status: friendship.status
            };
        });

        res.json({
            success: true,
            count: friends.length,
            data: friends,
            _links: {
                self: { href: `${process.env.BASE_URI}/api/friends` },
                requests: { href: `${process.env.BASE_URI}/api/friends/requests` }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/friends/requests - Get all pending friend requests
router.get('/requests', friendProtect , async (req, res) => {
    try {
        const userId = req.user.id;

        // Find incoming pending requests (user is the receiver)
        const incomingRequests = await Friend.find({
            receiver_user_id: userId,
            status: 'pending'
        }).populate('sender_user_id', 'username email image');

        // Find outgoing pending requests (user is the sender)
        const outgoingRequests = await Friend.find({
            sender_user_id: userId,
            status: 'pending'
        }).populate('receiver_user_id', 'username email image');

        // Format incoming requests
        const formattedIncoming = incomingRequests.map(req => ({
            id: req._id,
            sender: {
                id: req.sender_user_id._id,
                username: req.sender_user_id.username,
                email: req.sender_user_id.email,
                image: req.sender_user_id.image
            },
            status: req.status,
            createdAt: req.createdAt,
            _links: {
                self: { href: `${process.env.BASE_URI}/api/friends/${req._id}` },
                accept: { href: `${process.env.BASE_URI}/api/friends/${req._id}`, method: 'PATCH' },
                reject: { href: `${process.env.BASE_URI}/api/friends/${req._id}`, method: 'PATCH' }
            }
        }));

        // Format outgoing requests
        const formattedOutgoing = outgoingRequests.map(req => ({
            id: req._id,
            receiver: {
                id: req.receiver_user_id._id,
                username: req.receiver_user_id.username,
                email: req.receiver_user_id.email,
                image: req.receiver_user_id.image
            },
            status: req.status,
            createdAt: req.createdAt,
            _links: {
                self: { href: `${process.env.BASE_URI}/api/friends/${req._id}` },
                cancel: { href: `${process.env.BASE_URI}/api/friends/${req._id}`, method: 'DELETE' }
            }
        }));

        res.json({
            success: true,
            data: {
                incoming: formattedIncoming,
                outgoing: formattedOutgoing
            },
            _links: {
                self: { href: `${process.env.BASE_URI}/api/friends/requests` },
                friends: { href: `${process.env.BASE_URI}/api/friends` }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/friends/request - Send a friend request
router.post('/request', friendProtect , async (req, res) => {
    try {
        const senderId = req.user.id;
        const { userId, email } = req.body;

        // Find the receiver by ID or email
        let receiver;
        if (userId) {
            receiver = await User.findById(userId);
        } else if (email) {
            receiver = await User.findOne({ email });
        }

        if (!receiver) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if sender is trying to add themselves
        if (senderId === receiver._id.toString()) {
            return res.status(400).json({
                success: false,
                error: 'Cannot send friend request to yourself'
            });
        }

        // Check if a friendship already exists
        const existingFriendship = await Friend.findOne({
            $or: [
                { sender_user_id: senderId, receiver_user_id: receiver._id },
                { sender_user_id: receiver._id, receiver_user_id: senderId }
            ]
        });

        if (existingFriendship) {
            if (existingFriendship.status === 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'A pending request already exists between these users'
                });
            } else if (existingFriendship.status === 'accepted') {
                return res.status(400).json({
                    success: false,
                    error: 'You are already friends with this user'
                });
            } else if (existingFriendship.status === 'rejected' || existingFriendship.status === 'blocked') {
                // Update existing relationship to pending
                existingFriendship.status = 'pending';
                existingFriendship.sender_user_id = senderId;
                existingFriendship.receiver_user_id = receiver._id;
                existingFriendship.accepted_at = null;
                await existingFriendship.save();

                return res.status(201).json({
                    success: true,
                    message: 'Friend request sent successfully',
                    data: existingFriendship,
                    _links: {
                        self: { href: `${process.env.BASE_URI}/api/friends/${existingFriendship._id}` },
                        collection: { href: `${process.env.BASE_URI}/api/friends` }
                    }
                });
            }
        }

        // Create new friend request
        const friendRequest = await Friend.create({
            sender_user_id: senderId,
            receiver_user_id: receiver._id,
            status: 'pending'
        });

        res.status(201).json({
            success: true,
            message: 'Friend request sent successfully',
            data: friendRequest,
            _links: {
                self: { href: `${process.env.BASE_URI}/api/friends/${friendRequest._id}` },
                collection: { href: `${process.env.BASE_URI}/api/friends` }
            }
        });
    } catch (error) {
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'A relationship already exists between these users'
            });
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// PATCH /api/friends/:requestId - Accept or reject a friend request
router.patch('/:requestId', friendProtect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.body;
        const friendship = req.friendship; // From friendMiddleware

        // Validate status
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Status must be "accepted" or "rejected"'
            });
        }

        // Check if user is the receiver and status is pending
        if (friendship.receiver_user_id.toString() !== userId || friendship.status !== 'pending') {
            return res.status(403).json({
                success: false,
                error: 'You can only respond to your own pending requests'
            });
        }

        // Update the friendship
        friendship.status = status;
        if (status === 'accepted') {
            friendship.accepted_at = new Date();
        }
        await friendship.save();

        res.json({
            success: true,
            message: status === 'accepted' ? 'Friend request accepted' : 'Friend request rejected',
            data: friendship,
            _links: {
                self: { href: `${process.env.BASE_URI}/api/friends/${friendship._id}` },
                collection: { href: `${process.env.BASE_URI}/api/friends` },
                friends: { href: `${process.env.BASE_URI}/api/friends` }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// DELETE /api/friends/:friendId - Remove a friend or cancel a request
router.delete('/:friendId', friendProtect, async (req, res) => {
    try {
        const userId = req.user.id;
        const friendship = req.friendship; // From friendMiddleware

        // Check if user is involved in this friendship
        if (friendship.sender_user_id.toString() !== userId &&
            friendship.receiver_user_id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: 'You are not authorized to delete this friendship'
            });
        }

        // Delete the friendship
        await friendship.deleteOne();

        res.json({
            success: true,
            message: 'Friendship removed successfully',
            _links: {
                collection: { href: `${process.env.BASE_URI}/api/friends` },
                requests: { href: `${process.env.BASE_URI}/api/friends/requests` }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;