// Require the necessary modules
const express = require('express');
const path = require('path');
const http = require('http');
const passport = require('passport');
const session = require('express-session');
const socketio = require('socket.io');
require("dotenv").config();
require("module-alias/register");

// Initialize the express app and io server
const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Socket io connection handler
io.on("connection", (socket) => {
  console.info("New Client Connected");
  socket.on("disconnect", () => {
    console.info("User has left");
  });
});

// Require the necessary routes and database connection
const routes = require('@routes');
require("@lib/db");

// Import custom middleware to check DB connection and require channel
const { checkDBConnection } = require("@lib/middlewares");
const Channel = require("@models/channel");

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use(checkDBConnection);

// Middleware to attach user data to res.locals for views
app.use(async (req, res, next) => {
  res.locals.isCreateChannel = false
  if (req.user) {
    res.locals.channel = req.channel = req.user
  } else {
    req.channel = res.locals.channel = null
  }
  next()
});

// Application routes
app.use("/", checkDBConnection, routes);

// 404 error handler for unknown routes
app.use((req, res) => {
  res.status(404).render('404')
});

// Server port setup
server.listen(process.env.PORT || 4300, () => {
  console.log(`Server running on port ${process.env.PORT || 4300}`);
});

module.exports = { app, io };