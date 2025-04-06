// Import required modules
require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const passport = require('passport');
const session = require('express-session');
const socketio = require('socket.io');
require('module-alias/register');

// Initialize the Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Import routes, middleware, and database connection
const routes = require('./routes');
require('@lib/db');
const { checkDBConnection } = require('@lib/middlewares');

// Setup EJS view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware setup
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'supersecret',
        resave: false,
        saveUninitialized: true,
    })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(checkDBConnection);

// Attach user data to res.locals for views
app.use((req, res, next) => {
    res.locals.isCreateChannel = false;
    res.locals.channel = req.channel = req.user || null;
    next();
});

// Setup application routes
app.use('/', routes);

// Handle 404 errors
app.use((req, res) => res.status(404).render('404'));

// Socket.io connection handler
io.on('connection', (socket) => {
    console.info('New Client Connected');
    socket.on('disconnect', () => console.info('User has left'));
});

// Start the server
const PORT = process.env.PORT || 4300;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = { app, io };