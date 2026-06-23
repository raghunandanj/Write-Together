const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "Untitled Document",
    },
    content: {
      type: String,
      default: "",
    },
    // The user who created this document/room.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // A short, shareable code so others can join this room
    // (e.g. "x7K9mZ") - separate from MongoDB's internal _id
    // because we don't want to expose raw DB ids in shareable links.
    roomCode: {
      type: String,
      required: true,
      unique: true,
    },
    // Users who've been APPROVED to view/edit this document.
    // The owner is implicitly always allowed - this list is everyone else.
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Users who joined via room code but haven't been approved yet.
    // Stored as an array of { user, requestedAt } so the owner can see
    // who's waiting and decide whether to let them in.
    pendingRequests: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        requestedAt: { type: Date, default: Date.now },
      },
    ],
    // Users who were denied access.
    deniedRequests: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        deniedAt: { type: Date, default: Date.now },
      },
    ],
    // Map of userId -> Date for unread notifications
    lastViewed: {
      type: Map,
      of: Date,
      default: {},
    },
    // Map of userId -> "read-write" | "read-only"
    accessLevels: {
      type: Map,
      of: String,
      default: {},
    },
    // Historical snapshots of the document, manually saved by the owner
    snapshots: [
      {
        title: { type: String, required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", documentSchema);
