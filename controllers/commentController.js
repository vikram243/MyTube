const { formatNumber, getTimestamp } = require("@lib/utils")
const Channel = require("@models/channel")
const Comment = require("@models/comment")
const Video = require("@models/video")

const createComment = async (req, res) => {
    try {
        const { text } = req.body;
        const videoId = req.params.videoId;
        const channelId = req.channel.id;

        // Retrieve the video and check for an existing comment concurrently
        const [video, existingComment] = await Promise.all([
            Video.findById(videoId),
            Comment.findOne({ video: videoId, channel: channelId, text })
        ]);

        // Validate that the video exists
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // If a similar comment exists, return the current comments count without creating a new comment
        if (existingComment) {
            return res.status(200).json({ comments: formatNumber(video.comments.length) });
        }

        // Create and save the new comment
        const newComment = new Comment({
            video: videoId,
            channel: channelId,
            text,
        });
        await newComment.save();

        // Append the new comment's ID to the video's comments array and save the video document
        video.comments.push(newComment._id);
        await video.save();

        // Return the updated comment count along with the new comment details
        return res.status(201).json({
            comments: formatNumber(video.comments.length),
            comment: newComment
        });
    } catch (error) {
        console.error('Error creating comment:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

const updateCommentLikesDislikes = async (req, res) => {
    try {
        const { action } = req.query;
        const channelId = req.channel.id;

        // Validate action type
        if (!['like', 'dislike'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action. Use "like" or "dislike".' });
        }

        // Find comment and validate
        const comment = await Comment.findById(req.params.id);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Ensure the channel exists
        const channelExists = await Channel.exists({ _id: channelId });
        if (!channelExists) {
            return res.status(400).json({ error: 'Invalid channel ID' });
        }

        // Determine the fields to update
        const isLikeAction = action === 'like';
        const alreadyLiked = comment.likes.includes(channelId);
        const alreadyDisliked = comment.dislikes.includes(channelId);

        // No need to update if the action is redundant
        if ((isLikeAction && alreadyLiked) || (!isLikeAction && alreadyDisliked)) {
            return res.status(200).json({ likes: comment.likes.length });
        }

        // Construct update object
        const update = {
            $pull: { [isLikeAction ? 'dislikes' : 'likes']: channelId }, // Remove from opposite field
            [alreadyLiked || alreadyDisliked ? '$pull' : '$addToSet']: { [action === 'like' ? 'likes' : 'dislikes']: channelId }
        };

        // Perform update
        const updatedComment = await Comment.findByIdAndUpdate(req.params.id, update, { new: true });

        // Return updated like count
        return res.status(200).json({ likes: updatedComment.likes.length });
    } catch (error) {
        console.error('Error updating comment likes/dislikes:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

const replyToComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { video, text } = req.body;
        const channelId = req.channel.id;

        // Check if the comment exists
        const comment = await Comment.findById(id);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Validate video and channel existence concurrently
        const [videoExists, channelExists] = await Promise.all([
            Video.findById(video),
            Channel.findById(channelId)
        ]);

        if (!videoExists || !channelExists) {
            return res.status(400).json({ error: 'Invalid video or channel ID' });
        }

        // Create and save the new reply
        const newReply = new Comment({
            video,
            channel: channelId,
            text,
        });
        await newReply.save();

        // Append the new reply's ID to the parent comment and save
        comment.replies.push(newReply._id);
        await comment.save();

        return res.status(201).json(newReply);
    } catch (error) {
        console.error('Error replying to comment:', error);
        return res.status(500).json({ error: error.message });
    }
};

const deleteComment = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedComment = await Comment.findByIdAndDelete(id);

        if (!deletedComment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        return res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

const getComments = async (req, res) => {
    try {
        const { videoId } = req.params;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Fetch total comment count for pagination info
        const totalComments = await Comment.countDocuments({ video: videoId });

        // Fetch comments with pagination and population
        const comments = await Comment.find({ video: videoId })
            .sort({ postedDate: -1 }) // Sort by newest first
            .skip(skip)
            .limit(limit)
            .populate('channel', 'logoURL handle') // Populate channel details
            .populate({
                path: 'replies',
                populate: { path: 'channel', select: 'logoURL handle' } // Populate reply channels
            });

        return res.status(200).json({
            totalComments,
            totalPages: Math.ceil(totalComments / limit),
            currentPage: page,
            comments,
        });

    } catch (error) {
        console.error('Error fetching comments:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    createComment,
    updateCommentLikesDislikes,
    replyToComment,
    deleteComment,
    getComments,
};