const mongoose = require('mongoose');

// Middleware to check the database connection status
const checkDBConnection = (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(500).json({ error: 'Database connection error' });
    }
    next();
};

// Middleware to check if a channel is created by the logged-in user
const checkChannel = (req, res, next) => {
    if (!req.channel?.uid) {
        return res.status(403).json({ error: 'Unauthorized: Please create a channel first' });
    }
    next();
};

// Middleware to check if a user is logged in
const isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.redirect("/").status(401);
    }
    next();
};

// Utility function to handle async errors in middleware
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { checkDBConnection, checkChannel, isLoggedIn, asyncHandler };
