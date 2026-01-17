import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  uid: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userPhone: {
    type: String,
  },
  locations: [
    {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  activeViewers: {
    type: Number,
    default: 0,
  },
  ended: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  endedAt: {
    type: Date,
  },
});

// Auto-delete sessions after 24 hours using MongoDB TTL index
sessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model("Session", sessionSchema);
