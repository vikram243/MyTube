// Import necessary modules and models
const Video = require("@models/video")
const { generateID, formatNumber, getTimestamp } = require("@lib/utils")
const { connection } = require("@lib/db")
const { default: axios } = require("axios")
const crypto = require("crypto")
const fs = require('fs')
const path = require('path')
const Channel = require("@models/channel")
const Tag = require("@models/tag")
const Comment = require("@models/comment")
const { channel } = require("diagnostics_channel")
const { getSubscription } = require("./channelController")

// Environment variables for BunnyCDN
const BUNNY_API_KEY = process.env.BUNNY_API_KEY
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID

// function to get all hashtags from a text
const extractHashtags = (text, limit) => {
    const hashtags = text.match(/#[\w]+/g);
    return hashtags ? hashtags.map(ht => ht.substring(1)).slice(0, limit) : [];
};

// Endpoint to create a new video 
const createVideo = async (req, res) => {
    try {
        const { visibility, videoId, tags, title, description, comments, view } = req.body;
        const tagsArray = JSON.parse(tags || '[]');
        const hashTags = extractHashtags(description);

        let thumbnailUrl = null;
        if (req.file) {
            const filePath = path.join(req.file.destination, req.file.filename);
            thumbnailUrl = `${process.env.HOST_URL}/${req.file.filename}`;

            // Upload thumbnail to BunnyCDN
            await axios.post(
                `https://video.bunnycdn.com/library/${process.env.BUNNY_LIBRARY_ID}/videos/${videoId}/thumbnail?thumbnailUrl=${thumbnailUrl}`,
                null,
                { headers: { accept: 'application/json', AccessKey: process.env.BUNNY_API_KEY } }
            );

            // Delete temporary file
            fs.unlink(filePath, err => {
                if (err) console.error('Failed to delete file:', err);
            });
        }

        // Find and update video details
        let video = await Video.findOneAndUpdate(
            { videoId },
            {
                $set: {
                    isDraft: false,
                    privacySettings: visibility,
                    title,
                    description,
                    commentsStatus: comments.toLowerCase() === 'on',
                    viewsEnabled: view.toLowerCase() === 'on',
                    uploadDate: !video?.uploadDate && visibility === 'public' ? new Date() : video?.uploadDate
                }
            },
            { upsert: true, new: true }
        );

        // Remove video reference from existing tags
        await Tag.updateMany({ videos: video._id }, { $pull: { videos: video._id } });

        // Function to update tags
        const updateTags = async (tagNames) => {
            return Promise.all(tagNames.map(async name => {
                let tag = await Tag.findOne({ name });
                if (!tag) tag = new Tag({ name });
                tag.videos.addToSet(video._id); // Prevent duplicate references
                await tag.save();
                return tag;
            }));
        };

        // Update both normal tags and hashtags
        const updatedTags = await updateTags(tagsArray);
        const updatedHashTags = await updateTags(hashTags);

        // Send metadata update to BunnyCDN
        await axios.post(
            `https://video.bunnycdn.com/library/${process.env.BUNNY_LIBRARY_ID}/videos/${videoId}`,
            {
                metaTags: [
                    { property: 'title', value: title },
                    { property: 'description', value: description },
                    { property: 'tags', value: updatedTags.map(tag => tag._id).join(',') },
                    { property: 'privacySettings', value: visibility },
                    { property: 'commentsStatus', value: comments },
                    { property: 'viewsEnabled', value: view },
                    { property: 'isDraft', value: 'false' },
                    { property: 'uid', value: video.uid }
                ]
            },
            {
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    AccessKey: process.env.BUNNY_API_KEY
                }
            }
        );

        // Update video tags
        video.tags = updatedTags.map(tag => tag._id);
        video.hashTags = updatedHashTags.map(tag => tag._id);
        await video.save();

        res.status(200).json({ message: 'Video Updated Successfully' });

    } catch (error) {
        console.error('Error in createVideo:', error);
        res.status(500).json({ error: 'Something went wrong!' });
    }
};

// Function to get video from BunnyCDN
const getBunnyVideo = async (videoId) => {
    if (!videoId) {
        console.error("Error: videoId is required");
        return null;
    }

    const url = `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`;
    const headers = {
        Accept: "application/json",
        AccessKey: BUNNY_API_KEY,
    };

    try {
        const { data } = await axios.get(url, { headers });
        return data;
    } catch (error) {
        console.error("BunnyCDN API Error:", error.response?.data || error.message);
        return null;
    }
};

// Function to get video details
const getVideo = async (req, res) => {
    try {
        const { id: videoId } = req.params;

        // Fetch video details from BunnyCDN and local database concurrently
        const [bunnyVideo, video] = await Promise.all([
            getBunnyVideo(videoId),
            Video.findOne({ videoId }).populate("tags"),
        ]);

        if (!bunnyVideo || !video) {
            return res.status(404).json({ error: "Video not found" });
        }

        // Extract tag names
        const tags = video.tags.map(tag => tag.name).join(",");

        // Extract necessary details
        const {
            thumbnailFileName,
            category,
            title: filename,
            availableResolutions,
            metaTags,
        } = bunnyVideo;

        const {
            description,
            title,
            viewsEnabled,
            commentsStatus,
            status,
            privacySettings,
            uid,
        } = video;

        // Send the response
        res.json({
            viewsEnabled,
            filename,
            thumbnailFileName,
            title,
            description,
            status,
            tags,
            uid,
            commentsStatus,
            privacySettings,
            availableResolutions,
            category,
            metaTags,
        });

    } catch (error) {
        console.error("Error fetching video details:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Endpoint to get the video player link
const getPlayerLink = async (req, res) => {
    try {
        // Fetch video details from the database
        const video = await Video.findOne({ uid: req.query.v })
            .populate('channel comments')
            .populate({ path: 'hashTags', select: 'name' });

        // If the video doesn't exist, render an error page
        if (!video) {
            return res.render("error", { message: "Video Not Found" });
        }

        // Check if the user is the video owner
        const isOwner = video.channel.id === req.channel?.id;

        // If the video is a draft or private and the user is not the owner, restrict access
        if ((video.isDraft || video.privacySettings === 'private') && !isOwner) {
            return res.render("error", { message: "This video isn't available anymore" });
        }

        // Fetch video details from BunnyCDN
        const bunnyVideo = await getBunnyVideo(video.videoId);

        // Update video views from BunnyCDN if available
        if (bunnyVideo?.views) {
            video.views = bunnyVideo.views;
        }

        // Generate timestamp
        video.timestamp = getTimestamp(video.uploadDate || video.createdAt);

        // Fetch subscription details (checks if the current user is subscribed to the video's channel)
        const subscription = await getSubscription({
            subscriber: req.channel?.id,
            channel: video.channel.id
        });

        // Return player page details
        return { subscription, video, page: 'player' };

    } catch (error) {
        console.error("Error fetching player link:", error.message);
        return res.render("error", { message: "An error occurred. Please try again later." });
    }
};

// Endpoint to create a video upload
const createUpload = async (req, res) => {
    try {
        const { filename } = req.body;

        // Find the channel
        const channel = await Channel.findById(req.channel.id);
        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        // Create a new video entry in BunnyCDN
        const { data: videoResponse } = await axios.post(
            `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`,
            { title: filename, collectionId: channel.collectionId },
            { headers: { AccessKey: BUNNY_API_KEY } }
        );

        const { guid: videoId } = videoResponse;

        // Generate a unique UID for the video
        let uid, tempVideo;
        do {
            uid = generateID(videoId, 11, " ");
            tempVideo = await Video.findOne({ uid });
        } while (tempVideo);

        // Create and save new video in the database
        const newVideo = await Video.create({
            filename,
            videoId,
            uid,
            channel: channel.id,
            title: filename,
        });

        // Add video reference to the channel and save
        channel.videos.push(newVideo._id);
        await channel.save();

        // Generate authorization signature for video upload
        const expirationTime = Math.floor(Date.now() / 1000) + 3600;
        const authorizationSignature = crypto
            .createHash("sha256")
            .update(`${BUNNY_LIBRARY_ID}${BUNNY_API_KEY}${expirationTime}${videoId}`)
            .digest("hex");

        // Response headers for upload authorization
        const headers = {
            AuthorizationSignature: authorizationSignature,
            AuthorizationExpire: expirationTime,
            VideoId: videoId,
            LibraryId: BUNNY_LIBRARY_ID,
        };

        // Send the upload URL and headers
        res.json({ uploadUrl: `https://video.bunnycdn.com/tusupload`, headers });

    } catch (error) {
        console.error("Error creating video upload:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Endpoint to get all videos
const getStudioVideos = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const videos = await getVideos({
            channel: req.channel._id,
            page: Number(page),
            limit: Number(limit),
        });

        res.status(200).json(videos);
    } catch (error) {
        console.error("Error fetching studio videos:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Endpoint to get all shorts
const getStudioShorts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const shorts = await getVideos({
            channel: req.channel._id,
            page: Number(page),
            limit: Number(limit),
            isShort: true,
        });

        res.status(200).json(shorts);
    } catch (error) {
        console.error("Error fetching studio shorts:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Endpoint to get all tag shorts
const getTagShorts = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const { tag } = req.params;

        const shorts = await getVideos({
            page: Number(page),
            tag,
            privacySettings: "public",
            limit: Number(limit),
            isShort: true,
        });

        res.status(200).json(shorts);
    } catch (error) {
        console.error("Error fetching tagged shorts:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Endpoint to get all tag video
const getTagVideos = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const { tag } = req.params;

        const videos = await getVideos({
            tag,
            privacySettings: "public",
            page: Number(page),
            limit: Number(limit),
        });

        res.status(200).json(videos);
    } catch (error) {
        console.error("Error fetching tagged videos:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const searchVideos = async ({
    page = 1,
    limit = 10,
    search = null,
    collection = null,
    orderBy = null
}) => {
    try {
        const params = new URLSearchParams({
            page,
            limit,
            collection,
            ...(search && { search }),
            ...(orderBy && { orderBy }),
        });

        const response = await axios.get(
            `https://video.bunnycdn.com/library/${process.env.BUNNY_LIBRARY_ID}/videos?${params}`,
            { headers: { accept: "application/json", AccessKey: process.env.BUNNY_API_KEY } }
        );

        return response.data;
    } catch (error) {
        console.error("Error fetching videos:", error.response?.data || error.message);
        return null;
    }
};

// Endpoint to delete a video
const deleteVideo = async (req, res) => {
    try {
        const { videoId } = req.params;
        const { id: channelId } = req.channel;

        // Find and remove the video from the database
        const video = await Video.findOneAndDelete({ videoId, channel: channelId });

        if (!video) return res.status(404).json({ error: "Video not found" });

        // Delete the video from BunnyCDN
        const { data } = await axios.delete(
            `https://video.bunnycdn.com/library/${process.env.BUNNY_LIBRARY_ID}/videos/${videoId}`,
            { headers: { AccessKey: process.env.BUNNY_API_KEY } }
        );

        if (data.success) {
            return res.status(200).json({ message: "Video deleted successfully" });
        } else {
            return res.status(404).json({ error: "Video not found on BunnyCDN" });
        }
    } catch (error) {
        console.error("Error deleting video:", error.response?.data || error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Endpoint to check if the user can edit a video
const canEdit = async (req, res) => {
    try {
        const video = await Video.findOne({ videoId: req.params.id });

        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }

        const isOwner = video.channel.toString() === req.channel.id.toString();

        return res.status(isOwner ? 200 : 403).json({
            message: isOwner
                ? "You can edit this video"
                : "You are not authorized to edit this video",
        });
    } catch (error) {
        console.error("Error checking edit permissions:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Function to update video likes & dislikes
const updateVideoLikesDislikes = async (req, res) => {
    try {
        const { videoId } = req.params;
        const { action } = req.query;
        const userId = req.channel.id;

        // Validate action type
        if (!["like", "dislike"].includes(action)) {
            return res.status(400).json({ error: "Invalid action" });
        }

        // Find video
        const video = await Video.findById(videoId);
        if (!video) return res.status(404).json({ error: "Video not found" });

        // Determine the fields to update
        const isLikeAction = action === "like";
        const primaryField = isLikeAction ? "likes" : "dislikes";
        const oppositeField = isLikeAction ? "dislikes" : "likes";

        // Construct update query
        const update = {
            $pull: { [oppositeField]: userId }, // Remove from opposite field
            [video[primaryField].includes(userId) ? "$pull" : "$addToSet"]: {
                [primaryField]: userId,
            },
        };

        // Update the video and return the updated likes count
        const updatedVideo = await Video.findByIdAndUpdate(videoId, update, { new: true });

        res.status(200).json({ likes: formatNumber(updatedVideo.likes.length) });
    } catch (error) {
        console.error("Error updating video likes/dislikes:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Get All Public Videos
const getPublicVideos = async (req, res) => {
    try {
        const { page = 1, limit = 10, channel, tag, searchText } = req.query;

        const videos = await getVideos({
            privacySettings: "public",
            page,
            limit,
            channel,
            tag,
            searchText,
        });

        res.status(200).json(videos);
    } catch (error) {
        console.error("Error fetching public videos:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Get All Public Shorts
const getShorts = async (req, res) => {
    try {
        const { page = 1, limit = 1, uid, notUid, channel, tag } = req.query;

        console.log("Request Query:", req.query);

        const videos = await getVideos({
            privacySettings: "public",
            page,
            limit: parseInt(limit),
            uid,
            notUid,
            channel,
            tag,
            isShort: true,
        });

        res.status(200).json(videos);
    } catch (error) {
        console.error("Error fetching shorts:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Function to get videos
const getVideos = async (criteria) => {
    try {
        let {
            channel,
            lengthGreaterThan,
            lengthLessThan,
            privacySettings,
            category,
            title,
            description,
            sortOrder,
            isShort = false,
            page = 1,
            limit = 10,
            tag,
            searchText,
            uid,
            notUid,
        } = criteria;

        limit = parseInt(limit);

        // Construct query object
        const query = {
            ...(channel && { channel }),
            ...(lengthGreaterThan !== undefined && { length: { $gt: lengthGreaterThan } }),
            ...(lengthLessThan !== undefined && { length: { ...query.length, $lt: lengthLessThan } }),
            ...(privacySettings && { privacySettings }),
            ...(category && { category: category.toLowerCase() }),
            ...(isShort !== undefined && { isShort }),
            ...(uid && { uid }),
            ...(notUid && { uid: { $ne: notUid } }),
        };

        // Case-insensitive regex search for title & description
        if (title) query.title = { $regex: title, $options: "i" };
        if (description) query.description = { $regex: description, $options: "i" };

        // Handle search text filtering
        if (searchText) {
            const sanitizedSearchText = searchText.replace(/\s+/g, "");
            query.$or = [
                { title: { $regex: sanitizedSearchText, $options: "i" } },
                { description: { $regex: sanitizedSearchText, $options: "i" } },
            ];
        }

        // Fetch tag-based filtering
        if (tag) {
            const tagData = await Tag.findOne({ name: tag });
            const tagId = tagData?._id || null;
            query.$or = [{ tags: { $in: [tagId] } }, { hashTags: { $in: [tagId] } }];
        }

        // Sorting options
        const sortOptions = sortOrder ? { uploadDate: sortOrder === "asc" ? 1 : -1 } : {};

        // Count total matching videos
        const totalItems = await Video.countDocuments(query).exec();

        // Fetch paginated videos
        const videos = await Video.find(query)
            .select("title videoId description isDraft privacySettings likes dislikes uid uploadDate comments")
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
            .populate({
                path: "channel",
                select: "name uid logoURL",
            })
            .exec();

        // Determine next and previous pages
        const next = page * limit < totalItems ? page + 1 : null;
        const previous = page > 1 ? page - 1 : null;

        // Fetch additional video details from BunnyCDN
        const videosWithDetails = await Promise.all(
            videos.map(async (video) => {
                const { videoId, channel, description, isDraft, uploadDate, privacySettings, title, comments, uid, likes, dislikes } = video;

                // Fetch details from BunnyCDN
                const bunnyVideo = await getBunnyVideo(videoId);
                const { views, length, thumbnailFileName, category } = bunnyVideo;

                return {
                    restrictions: ["adult", "hentai"].includes(category?.toLowerCase()) ? "18+" : "none",
                    thumbnailFileName,
                    uid,
                    videoId,
                    channel,
                    likes,
                    views,
                    length,
                    description,
                    isDraft,
                    uploadDate,
                    privacySettings,
                    title,
                    comments: comments.length,
                    likeDislike: likes.length + dislikes.length === 0 ? 0 : (likes.length / (likes.length + dislikes.length)) * 100,
                };
            })
        );

        return { totalItems, currentPage: page, next, previous, items: videosWithDetails };
    } catch (error) {
        console.error("Error fetching videos:", error.message);
        throw error;
    }
};

module.exports = {
    createVideo,
    getVideo,
    getBunnyVideo,
    getPlayerLink,
    createUpload,
    getStudioVideos,
    getStudioShorts,
    getTagShorts,
    getTagVideos,
    searchVideos,
    deleteVideo,
    canEdit,
    updateVideoLikesDislikes,
    getPublicVideos,
    getShorts,
    getVideos,
};