const mongoose = require('mongoose');
const multer = require('multer');
const imageKit = require('imagekit');
const axios = require('axios');
require('dotenv').config();
const url = process.env.MONGODB_URL;

// Connect to MongoDB using mongoose
mongoose.connect(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.log('Error:', error.message);
});

const connection = mongoose.createConnection(url);

// Initialize ImageKit with credentials from environment variables
const imageKit = new imageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// BunnyCDN endpoint for video streaming
const bunnyStreamEndpoint = `https://video.bunnycdn.com/library/${process.env.BUNNY_STREAM_LIBRARY_ID}/videos`

// Function to create a video entry in BunnyCDN
const createVideoEntry = async(fileName) => {
    const response = await axios.post(bunnyStreamEndpoint, { title: fileName }, {
        headers: {
            'AccessKey': process.env.BUNNY_STREAM_API_KEY,
            'Content-Type': 'application/json'
        }
    });
    return response.data.guid;
};

// Configure multer for handling file uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = { connection, mongoose, upload, imageKit, createVideoEntry, bunnyStreamEndpoint};