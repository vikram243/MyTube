const channel = require('@models/channel');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Function to get timestamp difference from the createdAt time
const getTimestamp = (createdAt) => {
    const now = new Date();
    const timeDifference = now - createdAt; 

    const minutes = 60 * 1000;
    const hours = minutes * 60;
    const days = hours * 24;
    const weeks = days * 7;
    const years = now.getFullYear() - createdAt.getFullYear();
    const months = (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth());

    if (timeDifference < minutes) return "Just now";
    if (timeDifference < hours) return `${Math.floor(timeDifference / minutes)} minutes ago`;
    if (timeDifference < days) return `${Math.floor(timeDifference / hours)} hours ago`;
    if (timeDifference < weeks) return `${Math.floor(timeDifference / days)} days ago`;
    if (months < 12) return `${months} months ago`;
    return `${years} years ago`;
};

// Function to generate a unique ID based on input, length, and prefix
const generateID = (input, length, pre) => {
    `${pre || 'UCC'}${Buffer.from(bcrypt.hashSync(input, 10)).toString('base64').slice(10, length+10 || 32)}`.trim();
};

// Function to format numbers into a human-readable format
const formatNumber = (num) => {
    if (num < 1000) return num;
    if (num < 1000000) return `${(num / 1000).toFixed(0)}K`;
    if (num < 1000000000) return `${(num / 1000000).toFixed(1)}M`;
    return `${(num / 1000000000).toFixed(0)}B`;
};

// Function to generate a signature for BunnyCDN
const generateSignature = (libraryId, apiKey, expirationTime, videoId) => {
    const stringToSign = libraryId + apiKey + expirationTime + videoId;
    const hash = crypto.createHash('sha256').update(stringToSign).digest('hex');
    return hash;
};

// Function to convert Meta Tags To Object
const convertMetaTagsToObject = (metaTags) => {
    return metaTags.reduce((obj, item) => {
        obj[item.property] = item.value;
        return obj;
    }, {});
};

// Function to create unique handle for a channel
async function createUniqueHandle(baseHandle) {
    if (!await channel.findOne({ handle: baseHandle })) return baseHandle;
    
    let handle;
    do {
        const randomDigits = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        handle = `${baseHandle}${randomDigits}`;
    } while (await channel.findOne({ handle }));

    return handle;
}


module.exports = { convertMetaTagsToObject, createUniqueHandle, getTimestamp, generateID, formatNumber, generateSignature }