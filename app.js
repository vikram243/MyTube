var express = require('express');
var path = require('path');
require("dotenv").config();


var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
module.exports = app;

app.get("/",  function (req, res) {
  res.send("Working...");
});


app.listen(process.env.PORT||3000);