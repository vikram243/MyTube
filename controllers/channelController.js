// Import necessary modules and utilities
const { ImageKit } = require('@lib/db');
const { generateID } = require('@lib/utils');
const Channel = require('@models/channel');
const Subscription = require('@models/subscription');
const { default: axios } = require('axios');
const { error } = require('console');

// Creating new channel
const createChannel = async (req, res) => {
    try {
        const channel = req.channel;
        if (!channel) return res.status(400).json({ message: "Invalid channel data" });

        const uid = generateID(channel.id);

        // Check if handle is already taken
        if (req.query.handle) {
            const existingChannel = await Channel.findOne({ handle: req.query.handle });
            if (existingChannel && req.query.handle !== req.channel.uid) {
                return res.status(400).json({ message: "Channel handle already exists" });
            }
        }

        // Helper function to upload files
        const uploadFile = async (file) => {
            if (!file) return null;
            try {
                const response = await imageKit.upload({
                    file: file.buffer,
                    fileName: file.originalname,
                });
                return response.url || null;
            } catch (error) {
                console.error("Image upload failed:", error);
                return null;
            }
        };

        // Parallel execution: Upload logo + Create BunnyCDN collection
        const [logoURL, collectionResponse] = await Promise.all([
            req.file ? uploadFile(req.file) : null,
            axios.post(
                `https://video.bunnycdn.com/library/${process.env.BUNNY_LIBRARY_ID}/collections`,
                { name: uid },
                { headers: { AccessKey: process.env.BUNNY_API_KEY } }
            )
        ]);

        if (!collectionResponse.data.guid) {
            return res.status(500).json({ error: "Failed to create BunnyCDN collection." });
        }

        const { guid: collectionId } = collectionResponse.data;

        // Update and save channel
        Object.assign(channel, {
            ...(req.body.handle && { handle: req.body.handle }),
            ...(req.body.name && { name: req.body.name }),
            ...(logoURL && { logoURL }),
            collectionId,
            uid
        });

        await channel.save();
        res.status(200).json({ message: "Channel created successfully", uid });
    } catch (error) {
        console.error("Channel creation error:", error);
        res.status(500).json({ error: error.message || "Something went wrong while creating the channel." });
    }
};

// Updating channel
const updateChannel = async (req, res) => {
    try {
        const channel = req.channel;

        // Helper function to upload files
        const uploadFile = async (file) => {
            if (!file) return null;
            const response = await imageKit.upload({
                file: file.buffer,
                fileName: file.originalname,
            });
            return response.url || null;
        };

        // Upload logo and banner 
        const [logoURL, bannerImageURL] = await Promise.all([
            req.files?.logo ? uploadFile(req.files.logo[0]) : null,
            req.files?.banner ? uploadFile(req.files.banner[0]) : null
        ]);

        // Update channel details only if values exist in req.body
        Object.assign(channel, {
            ...(req.body.handle && { handle: req.body.handle }),
            ...(req.body.name && { name: req.body.name }),
            ...(req.body.description && { description: req.body.description }),
            ...(logoURL && { logoURL }),
            ...(bannerImageURL && { bannerImageURL }),
        });

        await channel.save();

        res.status(200).json({ message: "Channel updated successfully" });
    } catch (error) {
        console.error("Channel update error:", error);
        res.status(500).json({ error: error.message || "Something went wrong while updating the channel." });
    }
};

// Fetch a channel by its handle
const getChannelByHandle = async (handle) => {
    if (!handle) return null;

    try {
        return await Channel.findOne({ handle }).lean();
    } catch (error) {
        console.error(`Error fetching channel with handle:`, error);
        return null;
    }
};

// Fetch a channel by its UID
const getChannelByUid = async (uid) => {
    if (!uid) return null;

    try {
        return await Channel.findOne({ uid }).lean();
    } catch (error) {
        console.error(`Error fetching channel with UID:`, error);
        return null;
    }
};

// Fetch a channel by its ID
const getChannelById = async (id) => {
    if (!id) return null;

    try {
        return await Channel.findById(id).lean();
    }
    catch {
        console.error(`Error fetching channel with ID:`, error);
        return null;
    }
}

// Fetch a subscription by subscriber and channel
const getSubscription = async (subscriber, channel) => {
    if (!subscriber || !channel) return null;

    try {
        return await Subscription.findOne({ subscriber, channel }).lean();
    }
    catch {
        console.error(`Error fetching subscription:`, error);
        return null;
    }
}

// Fetch channel and subscription information
const getChannelAndSubscription = async (req, res, isHandle = true) => {
    try {
        const channelIdentifier = req.params[0];
        if (!channelIdentifier) return res.redirect("/404");

        // Fetch channel and subscription in parallel
        const [currentChannel, subscription] = await Promise.all([
            isHandle ? getChannelByHandle(channelIdentifier) : getChannelByUid(channelIdentifier),
            req.channel ? getSubscription({ subscriber: req.channel.id, channel: channelIdentifier }) : null
        ]);

        if (!currentChannel) return res.redirect("/404");

        res.render("devtube", { currentChannel, subscription, page: "channel" });
    } catch (error) {
        console.error(`Error fetching channel and subscription:`, error);
        res.status(500).send("Failed to fetch channel and subscription.");
    }
};

// Subscribe to a channel  
const subscribeChannel = async (req, res) => {
    if (!req.channel) {
        return res.status(401).json({ error: "Login to subscribe" });
    }

    try {
        const channel = await Channel.findOne({ uid: req.params.uid }).select("_id subscribers");

        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        // Check if the user is already subscribed
        const isSubscribed = await Subscription.exists({
            subscriber: req.channel.id,
            channel: channel.id,
        });

        if (isSubscribed) {
            return res.status(400).json({ error: "Already subscribed to this channel" });
        }

        // Create new subscription
        const subscription = new Subscription({
            subscriber: req.channel.id,
            channel: channel.id,
            mode: "notification",
        });

        req.channel.subscriptions.push(subscription._id);
        channel.subscribers.push(req.channel.id);

        // Save all changes in parallel
        await Promise.all([subscription.save(), req.channel.save(), channel.save()]);

        res.status(200).json({ message: "Subscription successful! Welcome to the club 🎉" });
    } catch (error) {
        console.error("Subscription error:", error);
        res.status(500).json({ error: "Oops! Something went wrong while subscribing." });
    }
};

// Unsubscribe from a channel
const unsubscribeChannel = async (req, res) => {
    try {
        if (!req.channel) {
            return res.status(401).json({ error: "Login to unsubscribe" });
        }

        const channel = await Channel.findOne({ uid: req.params.uid }).select("_id subscribers");

        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        // Check if subscription exists
        const subscription = await Subscription.findOne({
            subscriber: req.channel.id,
            channel: channel.id,
        }).select("_id subscriber");

        if (!subscription) {
            return res.status(400).json({ error: "You are not subscribed to this channel" });
        }

        // Remove subscription references
        req.channel.subscriptions.pull(subscription._id);
        channel.subscribers.pull(subscription.subscriber);

        // Save changes in parallel
        await Promise.all([req.channel.save(), channel.save(), subscription.deleteOne()]);

        res.status(200).json({ message: "Unsubscribed successfully" });
    } catch (error) {
        console.error("Unsubscription error:", error);
        res.status(500).json({ error: "Oops! Something went wrong while unsubscribing." });
    }
};

// Update notifications mode for a channel  
const notificationsChannel = async (req, res) => {
    try {
        if (!req.channel) {
            return res.status(401).json({ error: "Login to update notifications" });
        }

        const channel = await Channel.findOne({ uid: req.params.uid }).select("_id");

        if (!channel) {
            return res.status(404).json({ error: "Channel not found" });
        }

        const subscription = await getSubscription({ subscriber: req.channel._id, channel: channel._id });

        if (!subscription) {
            return res.status(400).json({ error: "You are not subscribed to this channel" });
        }

        // Validate mode value
        const validModes = ["notification", "silent"];
        if (!validModes.includes(req.params.mode)) {
            return res.status(400).json({ error: "Invalid mode. Choose 'notification' or 'silent'." });
        }

        // Update and save mode
        subscription.mode = req.params.mode;
        await subscription.save();

        res.status(200).json({ message: `Notifications set to '${subscription.mode}' successfully` });
    } catch (error) {
        console.error("Notifications error:", error);
        res.status(500).json({ error: "Oops! Something went wrong while updating notifications." });
    }
};

// Export all functions
module.exports = {
    createChannel,
    updateChannel,
    getChannelByHandle,
    getChannelByUid,
    getChannelById,
    getSubscription,
    getChannelAndSubscription,
    subscribeChannel,
    unsubscribeChannel,
    notificationsChannel
};