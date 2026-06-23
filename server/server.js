require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const Document = require("./models/Document");
const authRoutes = require("./routes/auth");
const documentRoutes = require("./routes/documents");
const { hasAccess } = require("./utils/access");

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || "*"
}));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"]
  },
});

app.set("io", io);

// --- SOCKET-LEVEL AUTH ---
// REST routes are protected by requireAuth middleware, but Socket.io
// connections don't go through Express middleware - they need their own
// check. This middleware runs once when a socket FIRST connects, before
// any "join-document" or other events are allowed to fire.
// Without this, anyone could open a raw socket connection and join any
// room without ever proving who they are.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id; // attach for use in event handlers below
    next();
  } catch (err) {
    next(new Error("Invalid or expired token"));
  }
});

// In-memory map of who's currently in each room: { documentId: Map of socketId -> {userId, userName} }
// This resets if the server restarts - fine for a resume project, but worth
// knowing that a production system would use Redis for this instead, so it
// survives server restarts and works across multiple server instances.
const roomPresence = new Map();
const typingTimers = new Map();
const editStacks = new Map(); // documentId -> array of edits

function getRoomUsers(documentId) {
  return Array.from(roomPresence.get(documentId)?.values() || []);
}

io.on("connection", (socket) => {
  console.log("authenticated connection:", socket.id, "user:", socket.userId);
  socket.join(socket.userId);

  socket.on("join-document", async ({ documentId, userName }) => {
    // AUTHENTICATION (io.use above) only proves who the socket belongs to.
    // AUTHORIZATION - whether THIS user can be in THIS specific document -
    // has to be checked here, per-room, every time someone tries to join.
    // Without this, a logged-in user could join-document on ANY id they
    // guess or are given, regardless of the room code/approval flow.
    let doc;
    try {
      doc = await Document.findById(documentId);
    } catch (err) {
      return socket.emit("join-denied", { reason: "Document not found" });
    }

    if (!doc || !hasAccess(doc, socket.userId)) {
      return socket.emit("join-denied", { reason: "You don't have access to this document" });
    }

    socket.join(documentId);
    socket.documentId = documentId; // remember for cleanup on disconnect

    // Track presence
    if (!roomPresence.has(documentId)) roomPresence.set(documentId, new Map());
    roomPresence.get(documentId).set(socket.id, { userId: socket.userId, userName });

    // Tell everyone in the room (including the new joiner) who's currently present
    io.to(documentId).emit("presence-update", getRoomUsers(documentId));

    // RECONNECT / RESUME SUPPORT: send the last-saved content straight
    // from the DB to whoever just joined.
    socket.emit("receive-changes", doc.content);
  });

  socket.on("send-changes", async ({ documentId, content }) => {
    // Re-check access on every change too - a user could have been removed
    // as a collaborator AFTER joining, and sockets stay connected until
    // they disconnect, so "joined once" shouldn't mean "trusted forever."
    const doc = await Document.findById(documentId);
    if (!doc || !hasAccess(doc, socket.userId)) return;
    socket.to(documentId).emit("receive-changes", content);
  });

  socket.on("save-document", async ({ documentId, content }) => {
    try {
      const doc = await Document.findById(documentId);
      if (!doc || !hasAccess(doc, socket.userId)) return;
      doc.content = content;
      if (!doc.lastViewed) doc.lastViewed = new Map();
      doc.lastViewed.set(socket.userId.toString(), new Date());
      await doc.save();
      
      // Notify owner and collaborators that the document was updated
      io.to(doc.owner.toString()).emit("dashboard-update");
      doc.collaborators.forEach(collabId => {
        io.to(collabId.toString()).emit("dashboard-update");
      });
    } catch (err) {
      console.error("Failed to save document:", err.message);
    }
  });

  socket.on("title-updated", ({ documentId, title }) => {
    socket.to(documentId).emit("title-updated", title);
  });

  socket.on("typing", ({ documentId }) => {
    const doc = roomPresence.get(documentId);
    if (!doc || !doc.has(socket.id)) return;
    
    socket.to(documentId).emit("user-typing", { userId: socket.userId, userName: doc.get(socket.id).userName });
    
    if (!typingTimers.has(documentId)) typingTimers.set(documentId, new Map());
    const roomTimers = typingTimers.get(documentId);
    
    if (roomTimers.has(socket.id)) clearTimeout(roomTimers.get(socket.id));
    
    const timer = setTimeout(() => {
      socket.to(documentId).emit("stopped-typing", { userId: socket.userId });
      roomTimers.delete(socket.id);
    }, 2000);
    
    roomTimers.set(socket.id, timer);
  });

  socket.on("new-edit", ({ documentId, userName, action }) => {
    if (!editStacks.has(documentId)) {
      editStacks.set(documentId, []);
    }
    const stack = editStacks.get(documentId);
    stack.push({ userName, action, timestamp: Date.now(), userId: socket.userId });
    
    // Broadcast the new top of the stack
    io.to(documentId).emit("last-edit-update", stack[stack.length - 1]);
  });

  socket.on("undo-edit", ({ documentId }) => {
    if (editStacks.has(documentId)) {
      const stack = editStacks.get(documentId);
      if (stack.length > 0) {
        stack.pop(); // Remove the undone edit
        const topEdit = stack.length > 0 ? stack[stack.length - 1] : null;
        io.to(documentId).emit("last-edit-update", topEdit);
      }
    }
  });

  socket.on("redo-edit", ({ documentId }) => {
    // Basic redo tracking could be added, but for now we'll just let 
    // the user typing (which Quill triggers on redo) push a new edit.
  });

  socket.on("disconnect", () => {
    console.log("user disconnected:", socket.id);
    if (socket.documentId && roomPresence.has(socket.documentId)) {
      roomPresence.get(socket.documentId).delete(socket.id);
      io.to(socket.documentId).emit("presence-update", getRoomUsers(socket.documentId));
    }
    
    if (socket.documentId && typingTimers.has(socket.documentId)) {
      const roomTimers = typingTimers.get(socket.documentId);
      if (roomTimers.has(socket.id)) {
        clearTimeout(roomTimers.get(socket.id));
        roomTimers.delete(socket.id);
        io.to(socket.documentId).emit("stopped-typing", { userId: socket.userId });
      }
    }
  });
});

mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/collab-docs")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err.message));

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
