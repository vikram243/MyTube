const channel = require('@models/channel');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Function to get a human-readable timestamp difference
const getTimestamp = (createdAt) => {
    const now = new Date();
    const diffMs = now - createdAt;

    const minutes = 60 * 1000;
    const hours = minutes * 60;
    const days = hours * 24;
    const weeks = days * 7;
    const months = now.getMonth() - createdAt.getMonth() + (12 * (now.getFullYear() - createdAt.getFullYear()));
    const years = now.getFullYear() - createdAt.getFullYear();

    if (diffMs < minutes) return "Just now";
    if (diffMs < hours) return `${Math.floor(diffMs / minutes)} minutes ago`;
    if (diffMs < days) return `${Math.floor(diffMs / hours)} hours ago`;
    if (diffMs < weeks) return `${Math.floor(diffMs / days)} days ago`;
    if (months < 12) return `${months} months ago`;
    return `${years} years ago`;
};

// Function to generate a unique ID
const generateID = (input, length = 32, prefix = 'UCC') => {
    return `${prefix}${Buffer.from(bcrypt.hashSync(input, 10)).toString('base64').slice(10, 10 + length)}`.trim();
};

// Function to format large numbers
const formatNumber = (num) => {
    if (num < 1000) return num.toString();
    if (num < 1_000_000) return `${(num / 1000).toFixed(0)}K`;
    if (num < 1_000_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    return `${(num / 1_000_000_000).toFixed(1)}B`;
};

// Function to generate a BunnyCDN signature
const generateSignature = (libraryId, apiKey, expirationTime, videoId) => {
    return crypto.createHash('sha256').update(`${libraryId}${apiKey}${expirationTime}${videoId}`).digest('hex');
};

// Function to convert an array of meta tags into an object
const convertMetaTagsToObject = (metaTags) => {
    return Object.fromEntries(metaTags.map(({ property, value }) => [property, value]));
};

// Function to create a unique channel handle
const createUniqueHandle = async (baseHandle) => {
    if (!await channel.findOne({ handle: baseHandle })) return baseHandle;
    let handle;
    do {
        handle = `${baseHandle}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    } while (await channel.findOne({ handle }));

    return handle;
};

module.exports = { 
    getTimestamp, 
    generateID, 
    formatNumber, 
    generateSignature, 
    convertMetaTagsToObject, 
    createUniqueHandle 
};
