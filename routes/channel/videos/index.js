const { checkChannel, asyncHandler, isloggedIn } = require("@lib/middlewares")
const { createVideo, deleteVideo, createUpload, getVideo, canEdit, getVideos } = require("@controllers/videoController")
const express = require("express")
const multer = require("multer")
const path = require('path')
const { createComment, getComments } = require("@controllers/commentController")
const router = express.Router()

const storage = multer.diskStorage({
    destination: './public/temp-upload/',
    filename: (req, file, cb) => {
        const timestamp = Date.now()
        const randomSuffix = Math.random().toString(36).substring(2, 10) // Shorter, readable suffix
        const fileExt = path.extname(file.originalname)
        const uniqueName = `${timestamp}-${randomSuffix}${fileExt}`
        cb(null, uniqueName)
    }
})

//get video api
router.get('/get-video/:id', checkChannel, isloggedIn, getVideo);

//check video edit api
router.get('/can-edit/:id', checkChannel, isloggedIn, canEdit);

//upload video to bunny api
router.post('/upload', isloggedIn, asyncHandler(createVideo));

//create video on bunny  api
router.post('/create-upload', isloggedIn, asyncHandler(createUpload));

//create video on bunny  api
router.post('/create-video', isloggedIn, multer({ storage: storage }).single('thumbnail'), asyncHandler(createVideo));

//delete video 
router.get('/delete/:videoId', isloggedIn, deleteVideo);

//send comments  
router.post('/comment/:videoId', isloggedIn, createComment);

//get comments  
router.get('/:videoId/comments', getComments);


module.exports = router;