const mongoose = require('mongoose');
const {Schema} = mongoose;

const commentSchema = new Schema({
    video: {
        type:  Schema.Types.ObjectId, 
        ref: 'Video',
        required: true
    },
    channel: {
        type: Schema.Types.ObjectId,
        ref: 'Channel',
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true
    },
    postDate: {
        type: Date,
        default: Date.now
    },
    likes: [{
        type: Schema.Types.ObjectId,
        default: 0,
        ref: 'channel'
    }],
    dislikes: [{
        type: Schema.Types.ObjectId,
        default: 0,
        ref: 'channel'
    }],
    replies: [{
        type: Schema.Types.ObjectId,
        ref: 'Comment'
    }]
});

const comment = mongoose.model('comment', commentSchema);
module.exports = comment;