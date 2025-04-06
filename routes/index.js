const express = require('express');
const router = express.Router();
const api = require('./api');
const channel = require('./channel');
const watch = require('./watch');
const studio = require('./studio');
// const { getPlayerLink, getTagVideos, getPublicVideos, getShorts } = require('@controllers/videoController');
const { default: axios } = require('axios');

const { getChannelAndSubscription } = require('@controllers/channelController')
const { checkChannel, isloggedIn } = require('@lib/middlewares')
const Tag = require('@models/tag')

//Home page
router.get('/', async (req, res) => {
    res.render('mytube', {
        page: 'home',
    })
});

// Search page
router.get('/search', async (req, res) => {
    res.render('mytube', {
        page: 'search',
        search: req.query.search
    })
});

//route for getting channel by handle
router.get(/^\/@(\w+)$/, getChannelAndSubscription);
router.get(/^\/@(\w+)\/videos$/, getChannelAndSubscription);
router.get(/^\/@(\w+)\/shorts$/, getChannelAndSubscription);

//upload  redirect
router.get('/upload', checkChannel, isloggedIn, (req, res) => {
    res.redirect(`/studio/channel/${req.channel.uid}/content?d=ud`)
});

//hashtag
router.get("/hashtag/:name", async (req, res) => {
    const hashTag = await Tag.findOne({ name: req.params.name })
    res.render("mytube", { page: 'hashTag', hashTag })
});

//shorts page 
router.get('/shorts/:uid', async (req, res) => res.render('mytube', {
    page: 'shorts',
    uid: req.params.uid
}));

//Forwarded routes
router.use('/api', api)
router.use('/watch', watch)
router.use('/channel', channel)
router.use('/studio', isloggedIn, checkChannel, studio)

router.get('/404', async (req, res) => res.render("404"))

module.exports = router;