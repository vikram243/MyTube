const mongoose = require('mongoose');

// Middleware to check the database connection status
const checkDBConnection = (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        res.status(500).json({ message: 'Database connection error' });
    } else {
        next();
    }
};

// Middleware to check if a channel is created by logged-in user
const checkChannel = (req, res, next) => {
    if (!req.channel?.uid) {
        res.redirect('/channel/create').status(403).json({ message: 'You are not authorized to perform this action' });
    } else {
        next();
    }
};

// Middleware to check if a user is logged in
const isloggedIn = (req, res, next) => {
    if(req.isAuthenticated()) {
        next();
    }
    else {
        res.redirect('/').status(401).json({ message: 'You are not logged in' });
    }
};

// Utility function to handle async errors in middleware
function asyncHandler(fn) {
    return function (req, res, next) {
        return Promise
            .resolve(fn(req, res, next))
            .catch(next);
    }
};

module.exports = { checkDBConnection, checkChannel, isloggedIn, asyncHandler };