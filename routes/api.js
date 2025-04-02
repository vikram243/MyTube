const Channel = require("@models/channel")
const Video = require("@models/video")
const { io } = require("../app")
const express = require("express")
const { subscribeChannel, unsubscribeChannel, notificationsChannel } = require("@controllers/channelController")
const passport = require("passport")
const { default: axios } = require('axios')
const crypto = require('crypto')
const { createUniqueHandle } = require("@lib/utils")
const { getBunnyVideo, getShorts, getPublicVideos, getTagVideos } = require("@controllers/videoController")

const router = express.Router();

// Check if handle is already registered
router.get('/checkHandle', async (req, res) => {
    try {
        const { handle } = req.query;

        if (!handle) {
            return res.status(400).json({ error: "Handle is required" });
        }

        const existingChannel = await Channel.findOne({ handle });

        // Check if handle exists and is not the current user's handle
        const isHandleTaken = existingChannel && handle !== req.channel?.handle;

        if (isHandleTaken) {
            const suggestedHandle = await createUniqueHandle(handle);
            return res.json({ exists: true, suggestedHandle });
        }

        res.json({ exists: false });
    } catch (error) {
        console.error("Error checking handle:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Update video status via BunnyCDN webhook
router.post('/updateStatus', async (req, res) => {
    try {
        const { VideoGuid, Status } = req.body;

        if (!VideoGuid || Status === undefined) {
            return res.status(400).json({ error: "VideoGuid and Status are required" });
        }

        // Status codes mapping
        const statusMap = {
            0: "Queued",
            1: "Processing...",
            2: "Encoding...",
            3: "Finished",
            4: "Resolution Sampled",
            5: "Failed",
            6: "Uploading...",
            7: "UploadFinished",
            8: "UploadFailed",
            9: "CaptionsGenerated",
            10: "Title Or Description Generated",
        };

        const video = await Video.findOne({ videoId: VideoGuid });

        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }

        // Update video status
        video.status = statusMap[Status] || "Unknown Status";

        // If encoding is finished, fetch additional details from BunnyCDN
        if (Status === 3) {
            const { length, width, height, category } = await getBunnyVideo(VideoGuid);

            const isShort = length <= 60 && width <= height;
            const aspectRatio = Math.min((height / width) * 100, 59);

            Object.assign(video, { length, category, aspect: aspectRatio, isShort });
        }

        await video.save();

        // Emit the updated status to clients
        io.emit(VideoGuid, video.status);

        res.status(200).json({ message: "Video status updated", status: video.status });
    } catch (error) {
        console.error("Error updating video status:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

//subscribe to channel
router.get('/subscribe/:uid', subscribeChannel);

//unsubscribe a channel
router.get('/unsubscribe/:uid', unsubscribeChannel);

//notification mode 
router.get('/notification/:uid/:mode', notificationsChannel);

// Get player thumbnail from BunnyCDN by videoId & thumbnailName
router.get('/getThumbnail', async (req, res) => {
    try {
        const { videoId, thumbnailName } = req.query;

        if (!videoId || !thumbnailName) {
            return res.status(400).json({ error: 'Missing videoId or thumbnailName' });
        }

        const path = `/${videoId}/${thumbnailName}.jpg`;
        const expires = Math.floor(Date.now() / 1000) + 3600; // 1-hour expiry

        // Generate BunnyCDN secure token
        const baseString = `${process.env.BUNNY_TOKEN_KEY}${path}${expires}`;
        const md5Hash = crypto.createHash('md5').update(baseString).digest('base64');
        const token = md5Hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        const imageUrl = `https://${process.env.BUNNY_CDN_HOSTNAME}${path}?token=${token}&expires=${expires}`;

        // Fetch and serve image
        const { data, headers } = await axios.get(imageUrl, { responseType: 'arraybuffer' });

        res.set({
            'Content-Type': headers['content-type'] || 'image/jpeg',
            'Cache-Control': 'public, max-age=3600',
        });

        res.send(data);
    } catch (error) {
        console.error('Error fetching thumbnail:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get BunnyCDN player using videoId
router.get('/player/:id', (req, res) => {
    try {
        const { id: videoId } = req.params;

        if (!videoId) {
            return res.status(400).json({ error: 'Missing videoId' });
        }

        const expiration = Math.floor(Date.now() / 1000) + 3600; // 1-hour expiration
        const token = crypto
            .createHash('sha256')
            .update(`${process.env.BUNNY_TOKEN_KEY}${videoId}${expiration}`)
            .digest('hex');

        const secureUrl = `https://iframe.mediadelivery.net/embed/${process.env.BUNNY_LIBRARY_ID}/${videoId}?token=${token}&expires=${expiration}`;

        res.redirect(secureUrl);
    } catch (error) {
        console.error('Error generating player URL:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

//get shorts
router.get('/shorts', getShorts)

//get videos
router.get('/videos', getPublicVideos)
router.get('/hashtag/:tag/videos', getTagVideos)

//login with google
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }))

//google login callback
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/" }), (req, res) => res.redirect("/"))

// Logout endpoint
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error("Error logging out:", err)
            return res.status(500).json({ error: "Error logging out" })
        }
        res.status(200).json({ message: "Successfully logged out" })
    })
})

module.exports = router;