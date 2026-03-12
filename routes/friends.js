import express from 'express';
import mongoose from 'mongoose';
import Friend from '../models/friendModel.js';
import User from '../models/userModel.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/friends
router.get('/', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        // Find all friendships where the user is either the sender or receiver and the status is accepted
        const friendships = await Friend.find({
            $or: [
                { sender_user_id: userId, status: 'accepted' },
                { receiver_user_id: userId, status: 'accepted' }
            ]
        }).populate('sender_user_id receiver_user_id', 'username email image');

        //response for each friendship
        const friends = friendships.map(friendship => {
            const isSender = friendship.sender_user_id._id.toString() === userId;
            const friend = isSender ? friendship.receiver_user_id : friendship.sender_user_id;

            return {
                id: friend._id,
                username: friend.username,
                email: friend.email,
                image: friend.image,
                friendshipId: friendship._id,
                since: friendship.accepted_at || friendship.updatedAt
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

// GET /api/friends/requests
router.get('/requests', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        // incoming requests
        const incomingRequests = await Friend.find({
            receiver_user_id: userId,
            status: 'pending'
        }).populate('sender_user_id', 'username email image');

        // outgoing requests
        const outgoingRequests = await Friend.find({
            sender_user_id: userId,
            status: 'pending'
        }).populate('receiver_user_id', 'username email image');

        // format the response to include user details and links
        const formattedIncoming = incomingRequests.map(req => ({
            id: req._id,
            sender: {
                id: req.sender_user_id._id,
                username: req.sender_user_id.username,
                email: req.sender_user_id.email,
                image: req.sender_user_id.image
            },
            status: req.status,
            createdAt: req.createdAt
        }));

        const formattedOutgoing = outgoingRequests.map(req => ({
            id: req._id,
            receiver: {
                id: req.receiver_user_id._id,
                username: req.receiver_user_id.username,
                email: req.receiver_user_id.email,
                image: req.receiver_user_id.image
            },
            status: req.status,
            createdAt: req.createdAt
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

// POST /api/friends/request
router.post('/request', protect, async (req, res) => {
    try {
        const senderId = req.user.id;
        const { userId, email } = req.body;

        // search user by id or email?
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

        // check if sender is trying to send request to themselves
        if (senderId === receiver._id.toString()) {
            return res.status(400).json({
                success: false,
                error: 'Cannot send friend request to yourself'
            });
        }

        // check if there is already a friendship or pending request between these users
        const existingFriendship = await Friend.findExistingFriendship(senderId, receiver._id);

        if (existingFriendship) {
            if (existingFriendship.status === 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'Pending request already exists'
                });
            } else if (existingFriendship.status === 'accepted') {
                return res.status(400).json({
                    success: false,
                    error: 'Yay! You are now friends'
                });
            } else if (existingFriendship.status === 'rejected') {
                existingFriendship.status = 'pending';
                existingFriendship.sender_user_id = senderId;
                existingFriendship.receiver_user_id = receiver._id;
                await existingFriendship.save();

                return res.status(201).json({
                    success: true,
                    message: 'Friendship request re-sent',
                    data: existingFriendship
                });
            }
        }

        //make new friend request
        const friendRequest = await Friend.create({
            sender_user_id: senderId,
            receiver_user_id: receiver._id,
            status: 'pending'
        });

        res.status(201).json({
            success: true,
            message: 'Friendship request sent',
            data: friendRequest
        });
    } catch (error) {
        //check for duplicate key error (unique index violation)
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'There is already a pending request between these users'
            });
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// PATCH /api/friends/:requestId
router.patch('/:requestId', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { requestId } = req.params;
        const { status } = req.body;

        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Status moet "accepted" of "rejected" zijn'
            });
        }

        //Find the friend request and check if the user is the receiver and the status is pending
        const friendRequest = await Friend.findOne({
            _id: requestId,
            receiver_user_id: userId,
            status: 'pending'
        });

        if (!friendRequest) {
            return res.status(404).json({
                success: false, error: 'Request not found'
            });
        }

        // Update status
        friendRequest.status = status;
        if (status === 'accepted') {
            friendRequest.accepted_at = new Date();
        }
        await friendRequest.save();

        res.json({
            success: true,
            message: status === 'accepted' ? 'Friendship accepted' : 'Friendship rejected',
            data: friendRequest
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// DELETE in /api/friends/:friendId
router.delete('/:friendId', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendId } = req.params;

        //Find the friendship and check if the user is involved
        const friendship = await Friend.findOne({
            _id: friendId,
            $or: [
                { sender_user_id: userId, status: 'accepted' },
                { receiver_user_id: userId, status: 'accepted' }
            ]
        });

        if (!friendship) {
            return res.status(404).json({
                success: false, error: 'Friendship not found'
            });
        }

        await friendship.deleteOne();

        res.json({
            success: true,
            message: 'friendship deleted'
        });
    } catch (error) {
        res.status(500).json({
            success: false, error: error.message
        });
    }
});

export default router;