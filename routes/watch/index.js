const { getPlayerLink, updateVideoLikesDislikes } = require('@controllers/videoController')
const { isloggedIn } = require('@lib/middlewares')
const express = require('express')
const router = express.Router()

//Watch Video Page
router.get('/', async (req, res) => res.render('mytube', (await getPlayerLink(req, res))))

router.get('/react/:videoId', isloggedIn, updateVideoLikesDislikes)


module.exports = router;