const mongoose = require('mongoose');
const {Schema} = mongoose;

const tagSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    videos: [{
        type: Schema.Types.ObjectId,
        ref: 'Video',
    }],
    channel: [{
        type: Schema.Types.ObjectId,
        ref: 'Channel'
    }]
});

const tag = mongoose.model('tag', tagSchema);
module.exports = tag;