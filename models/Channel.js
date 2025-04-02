const mongoose = require("mongoose");
const { Schema } = mongoose;

const ChannelSchema = new Schema({
  name: { type: String, required: true, trim: true },
  uid: { type: String },
  email: { type: String, trim: true },
  handle: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  logoURL: { type: String, trim: true },
  bannerImageURL: { type: String, trim: true },
  createdDate: { type: Date, default: Date.now },
  subscribers: [{ type: Schema.Types.ObjectId, ref: "Channel" }],
  tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
  subscriptions: [{ type: Schema.Types.ObjectId, ref: "Subscription" }],
  collectionId: { type: String },
  videos: [{ type: Schema.Types.ObjectId, ref: "Video" }]
});


ChannelSchema.index(
  { uid: 1 },
  { unique: true, sparse: true, partialFilterExpression: { uid: { $exists: true, $ne: null } } }
);

ChannelSchema.index(
  { handle: 1 },
  { unique: true, sparse: true, partialFilterExpression: { handle: { $exists: true, $ne: null } } }
);

ChannelSchema.index(
  { collectionId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { collectionId: { $exists: true, $ne: null } } }
);

ChannelSchema.index({ name: "text", description: "text" });

const channel = mongoose.model("channel", ChannelSchema);

module.exports = channel;
