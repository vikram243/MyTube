const mongoose = require('mongoose');
const multer = require('multer');
const ImageKit = require('imagekit');
const axios = require('axios');
require('dotenv').config();

const { MONGODB_URI, IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT, BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY } = process.env;


// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((error) => console.error('❌ MongoDB Connection Error:', error.message));

const connection = mongoose.createConnection(MONGODB_URI);

// Initialize ImageKit
const imagekit = new ImageKit({
  publicKey: IMAGEKIT_PUBLIC_KEY,
  privateKey: IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: IMAGEKIT_URL_ENDPOINT,
});

// BunnyCDN Video API Endpoint
const bunnyStreamEndpoint = `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos`;

// Function to create a video entry in BunnyCDN
const createVideoEntry = async (fileName) => {
  try {
    const { data } = await axios.post(
      bunnyStreamEndpoint,
      { title: fileName },
      {
        headers: {
          'AccessKey': BUNNY_STREAM_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    return data.guid;
  } catch (error) {
    console.error("❌ BunnyCDN Video Creation Error:", error.response?.data || error.message);
    throw new Error("Failed to create video entry in BunnyCDN");
  }
};

// Configure multer for in-memory file handling
const upload = multer({ storage: multer.memoryStorage() });

// Export modules
module.exports = { connection, mongoose, upload, imagekit, createVideoEntry, bunnyStreamEndpoint };