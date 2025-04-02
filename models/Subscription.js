const mongoose = require('mongoose');
const {Schema} = mongoose;

const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId,
        ref: 'Channel',
        required: true
    },
    channel: {
        type: Schema.Types.ObjectId,
        ref: 'Channel',
        required: true
    },
    mode: {
        type: String,
        enum: ['silent', 'notification'],
        required: true
    }
});

const subscription = mongoose.model('subscription', subscriptionSchema);
module.exports = subscription;