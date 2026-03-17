import express from 'express';
import Friend from '../src/models/Friend.js';
import User from '../src/models/User.js';

const router = express.Router();

// OPTIONS for collection
router.options("/", (req, res) => {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.sendStatus(204);
});

// OPTIONS for single resource
router.options("/:id", (req, res) => {
    res.setHeader("Allow", "GET, OPTIONS, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.sendStatus(204);
});

// GET /api/friends
router.get('/', async (req, res) => {
    try {
        // Get userId from query parameter
        const userId = req.query.userId;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId query parameter is required'
            });
        }

        // Find all accepted friendships where the user is involved (exclude blocked)
        const friendships = await Friend.find({
            $or: [
                { sender_user_id: userId, status: 'accepted' },
                { receiver_user_id: userId, status: 'accepted' }
            ],
            status: { $ne: 'blocked' }
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
                self: { href: `${process.env.BASE_URI}/api/friends?userId=${userId}` },
                requests: { href: `${process.env.BASE_URI}/api/friends/requests?userId=${userId}` }
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
router.get('/requests', async (req, res) => {
    try {
        // Get userId from query parameter
        const userId = req.query.userId;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId query parameter is required'
            });
        }

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

        // Filter out any requests where a blocked relationship exists
        const filteredIncoming = incomingRequests.filter(req => {
            // Check if there's any blocked relationship between these users
            return !incomingRequests.some(r => 
                r.status === 'blocked' && 
                ((r.sender_user_id._id.toString() === userId && r.receiver_user_id._id.toString() === req.sender_user_id._id.toString()) ||
                 (r.receiver_user_id._id.toString() === userId && r.sender_user_id._id.toString() === req.sender_user_id._id.toString()))
            );
        });

        const filteredOutgoing = outgoingRequests.filter(req => {
            // Check if there's any blocked relationship between these users
            return !outgoingRequests.some(r => 
                r.status === 'blocked' && 
                ((r.sender_user_id._id.toString() === userId && r.receiver_user_id._id.toString() === req.receiver_user_id._id.toString()) ||
                 (r.receiver_user_id._id.toString() === userId && r.sender_user_id._id.toString() === req.receiver_user_id._id.toString()))
            );
        });

        // Format incoming requests
        const formattedIncoming = filteredIncoming.map(req => ({
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
        const formattedOutgoing = filteredOutgoing.map(req => ({
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
                self: { href: `${process.env.BASE_URI}/api/friends/requests?userId=${userId}` },
                friends: { href: `${process.env.BASE_URI}/api/friends?userId=${userId}` }
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
router.post('/request', async (req, res) => {
    try {
        // Get senderId from request body
        const { senderId, userId } = req.body;

        if (!senderId) {
            return res.status(400).json({
                success: false,
                error: 'senderId is required in request body'
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required in request body'
            });
        }

        // Validate that the receiver user exists by ID
        const receiver = await User.findById(userId);

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
            if (existingFriendship.status === 'blocked') {
                // Check if senderId is the one who was blocked (sender of the blocked request)
                if (existingFriendship.sender_user_id.toString() === senderId) {
                    // Sender was blocked, cannot send request
                    return res.status(403).json({
                        success: false,
                        error: 'You cannot send a friend request to this user because you are blocked'
                    });
                } else {
                    // Sender did the blocking, allow them to unblock by sending request
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
            } else if (existingFriendship.status === 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'A pending request already exists between these users'
                });
            } else if (existingFriendship.status === 'accepted') {
                return res.status(400).json({
                    success: false,
                    error: 'You are already friends with this user'
                });
            } else if (existingFriendship.status === 'rejected') {
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
router.patch('/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        const { userId, status } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required in request body'
            });
        }

        // Validate status
        if (!['accepted', 'rejected', 'blocked'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Status must be "accepted", "rejected", or "blocked"'
            });
        }

        // Find the friend request
        const friendship = await Friend.findById(requestId);

        if (!friendship) {
            return res.status(404).json({
                success: false,
                error: 'Friend request not found'
            });
        }

        // Check if user is the receiver
        if (friendship.receiver_user_id.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: 'You can only respond to your own pending requests'
            });
        }

        // Check if status is pending
        if (friendship.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: 'This request has already been processed'
            });
        }

        // Update the friendship
        friendship.status = status;
        if (status === 'accepted') {
            friendship.accepted_at = new Date();
        } else if (status === 'blocked') {
            friendship.accepted_at = null;
        }
        await friendship.save();

        res.json({
            success: true,
            message: status === 'accepted' ? 'Friend request accepted' : status === 'blocked' ? 'User blocked successfully' : 'Friend request rejected',
            data: friendship,
            _links: {
                self: { href: `${process.env.BASE_URI}/api/friends/${friendship._id}` },
                collection: { href: `${process.env.BASE_URI}/api/friends` }
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
router.delete('/:friendId', async (req, res) => {
    try {
        const { friendId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required in request body'
            });
        }

        // Find the friendship
        const friendship = await Friend.findById(friendId);

        if (!friendship) {
            return res.status(404).json({
                success: false,
                error: 'Friendship not found'
            });
        }

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