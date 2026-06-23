const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Document = require("../models/Document");
const requireAuth = require("../middleware/requireAuth");
const { isOwner, hasAccess, hasPendingRequest } = require("../utils/access");

function generateRoomCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

router.use(requireAuth);

// POST /api/documents - create a new document/room.
// The creator is the owner and has access by default - no need to add
// them to collaborators too, since hasAccess() already checks isOwner.
router.post("/", async (req, res) => {
  try {
    const doc = await Document.create({
      title: req.body.title || "Untitled Document",
      owner: req.userId,
      roomCode: generateRoomCode(),
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: "Failed to create document" });
  }
});

// GET /api/documents - documents the user owns OR has been approved into OR has requested to join.
router.get("/", async (req, res) => {
  try {
    const docs = await Document.find({
      $or: [
        { owner: req.userId }, 
        { collaborators: req.userId },
        { "pendingRequests.user": req.userId },
        { "deniedRequests.user": req.userId }
      ],
    }).sort({ updatedAt: -1 })
      .populate("collaborators", "name email")
      .populate("owner", "name email");
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// POST /api/documents/join - request access to a room using its code.
// This NO LONGER grants access immediately. It either:
//   - returns "pending" if the user isn't approved yet (and records the request)
//   - returns the document directly if they're already a collaborator/owner
// IMPORTANT: must stay before "/:id" - see note further down.
router.post("/join", async (req, res) => {
  try {
    const { roomCode } = req.body;
    const cleanCode = roomCode?.trim()?.toUpperCase();
    const doc = await Document.findOne({ roomCode: cleanCode });
    if (!doc) return res.status(404).json({ error: "No room found with that code" });

    if (hasAccess(doc, req.userId)) {
      return res.json({ status: "approved", document: doc });
    }

    if (hasPendingRequest(doc, req.userId)) {
      return res.json({ status: "pending", document: { _id: doc._id, title: doc.title } });
    }

    // If they were previously denied, they can't request again (or maybe they can, but let's clear it)
    doc.deniedRequests = doc.deniedRequests.filter((r) => r.user.toString() !== req.userId);

    doc.pendingRequests.push({ user: req.userId });
    await doc.save();

    const io = req.app.get("io");
    if (io) io.to(doc.owner.toString()).emit("dashboard-update");

    res.json({ status: "pending", document: { _id: doc._id, title: doc.title } });
  } catch (err) {
    res.status(500).json({ error: "Failed to request access" });
  }
});

// GET /api/documents/:id - fetch one document, but ONLY if the requester
// has access. This is the main access-control checkpoint for the editor:
// without this check, anyone with a raw document _id (not even the room
// code) could load the content via the REST API directly.
router.get("/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate("owner", "name email")
      .populate("collaborators", "name email");
    if (!doc) return res.status(404).json({ error: "Document not found" });

    if (!hasAccess(doc, req.userId)) {
      if (hasPendingRequest(doc, req.userId)) {
        return res.status(403).json({ error: "Your request to join is awaiting approval", pending: true });
      }
      return res.status(403).json({ error: "You don't have access to this document" });
    }

    // Record last viewed time without triggering updatedAt
    await Document.updateOne(
      { _id: doc._id },
      { $set: { [`lastViewed.${req.userId}`]: new Date() } },
      { timestamps: false }
    );

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

// GET /api/documents/:id/requests - owner views pending join requests
router.get("/:id/requests", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).populate("pendingRequests.user", "name email");
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!isOwner(doc, req.userId)) {
      return res.status(403).json({ error: "Only the owner can view join requests" });
    }
    res.json(doc.pendingRequests);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

// POST /api/documents/:id/requests/:userId/approve - owner approves a request
router.post("/:id/requests/:userId/approve", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!isOwner(doc, req.userId)) {
      return res.status(403).json({ error: "Only the owner can approve requests" });
    }

    doc.pendingRequests = doc.pendingRequests.filter(
      (r) => r.user.toString() !== req.params.userId
    );
    doc.deniedRequests = doc.deniedRequests.filter(
      (r) => r.user.toString() !== req.params.userId
    );
    if (!doc.collaborators.some((c) => c.toString() === req.params.userId)) {
      doc.collaborators.push(req.params.userId);
    }
    
    // Set the access level
    const accessLevel = req.body.accessLevel || "read-write";
    if (!doc.accessLevels) doc.accessLevels = new Map();
    doc.accessLevels.set(req.params.userId, accessLevel);
    
    await doc.save();

    const io = req.app.get("io");
    if (io) io.to(req.params.userId).emit("dashboard-update");

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to approve request" });
  }
});

// POST /api/documents/:id/requests/:userId/deny - owner denies a request
router.post("/:id/requests/:userId/deny", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!isOwner(doc, req.userId)) {
      return res.status(403).json({ error: "Only the owner can deny requests" });
    }

    doc.pendingRequests = doc.pendingRequests.filter(
      (r) => r.user.toString() !== req.params.userId
    );
    if (!doc.deniedRequests.some((r) => r.user.toString() === req.params.userId)) {
      doc.deniedRequests.push({ user: req.params.userId });
    }
    await doc.save();

    const io = req.app.get("io");
    if (io) io.to(req.params.userId).emit("dashboard-update");

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to deny request" });
  }
});

// DELETE /api/documents/:id/requests/dismiss - user dismisses their denied request
router.delete("/:id/requests/dismiss", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    doc.deniedRequests = doc.deniedRequests.filter(
      (r) => r.user.toString() !== req.userId
    );
    await doc.save();
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to dismiss request" });
  }
});

// DELETE /api/documents/:id/collaborators/:userId - owner revokes access OR user leaves
router.delete("/:id/collaborators/:userId", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!isOwner(doc, req.userId) && req.userId !== req.params.userId) {
      return res.status(403).json({ error: "Only the owner or the user themselves can remove this collaborator" });
    }

    doc.collaborators = doc.collaborators.filter((c) => c.toString() !== req.params.userId);
    await doc.save();

    const io = req.app.get("io");
    if (io) {
      io.to(doc.owner.toString()).emit("dashboard-update");
      io.to(req.params.userId).emit("dashboard-update");
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove collaborator" });
  }
});

// PUT /api/documents/:id/collaborators/:userId/access - owner changes collaborator access
router.put("/:id/collaborators/:userId/access", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!isOwner(doc, req.userId)) {
      return res.status(403).json({ error: "Only the owner can manage access" });
    }

    const { accessLevel } = req.body;
    if (!["read-only", "read-write"].includes(accessLevel)) {
      return res.status(400).json({ error: "Invalid access level" });
    }

    if (!doc.accessLevels) doc.accessLevels = new Map();
    doc.accessLevels.set(req.params.userId, accessLevel);
    await doc.save();

    const io = req.app.get("io");
    if (io) {
      io.to(doc.owner.toString()).emit("dashboard-update");
      io.to(req.params.userId).emit("dashboard-update");
      // Notify the room so the editor updates in real-time
      io.to(req.params.id).emit("access-updated", { userId: req.params.userId, accessLevel });
    }

    res.json({ success: true, accessLevel });
  } catch (err) {
    res.status(500).json({ error: "Failed to update access level" });
  }
});

// PATCH /api/documents/:id - rename a document (owner only)
router.patch("/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!isOwner(doc, req.userId)) {
      return res.status(403).json({ error: "Only the owner can rename this document" });
    }
    if (req.body.title) doc.title = req.body.title;
    await doc.save();
    
    const io = req.app.get("io");
    if (io) {
      io.to(doc.owner.toString()).emit("dashboard-update");
      doc.collaborators.forEach((collabId) => {
        io.to(collabId.toString()).emit("dashboard-update");
      });
    }

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: "Failed to rename document" });
  }
});

// POST /api/documents/:id/snapshots - create a snapshot
router.post("/:id/snapshots", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!isOwner(doc, req.userId)) {
      return res.status(403).json({ error: "Only the owner can create snapshots" });
    }

    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Snapshot title is required" });

    doc.snapshots.push({
      title,
      content: doc.content,
      createdAt: new Date(),
    });
    await doc.save();
    res.json(doc.snapshots);
  } catch (err) {
    res.status(500).json({ error: "Failed to create snapshot" });
  }
});

// POST /api/documents/:id/snapshots/:snapshotId/restore - restore a snapshot
router.post("/:id/snapshots/:snapshotId/restore", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!isOwner(doc, req.userId)) {
      return res.status(403).json({ error: "Only the owner can restore snapshots" });
    }

    const snapshot = doc.snapshots.id(req.params.snapshotId);
    if (!snapshot) return res.status(404).json({ error: "Snapshot not found" });

    doc.content = snapshot.content;
    await doc.save();

    const io = req.app.get("io");
    if (io) {
      // Emit event to all clients in the document room
      io.to(doc._id.toString()).emit("document-restored", doc.content);
    }

    res.json({ success: true, content: doc.content });
  } catch (err) {
    res.status(500).json({ error: "Failed to restore snapshot" });
  }
});

// DELETE /api/documents/:id - delete a document (owner only)
router.delete("/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!isOwner(doc, req.userId)) {
      return res.status(403).json({ error: "Only the owner can delete this document" });
    }
    const collaborators = doc.collaborators;
    const ownerId = doc.owner;
    await doc.deleteOne();

    const io = req.app.get("io");
    if (io) {
      io.to(ownerId.toString()).emit("dashboard-update");
      collaborators.forEach((collabId) => {
        io.to(collabId.toString()).emit("dashboard-update");
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete document" });
  }
});

module.exports = router;
