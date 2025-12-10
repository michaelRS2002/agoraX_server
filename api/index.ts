/**
 * @fileoverview AgoraX Real-time Communication Server
 * @module agorax_server
 * @description WebSocket server for real-time chat and user presence management in AgoraX meeting rooms.
 * This server handles room-based communication, user tracking, and chat message persistence.
 */

import { Server, type Socket } from "socket.io";
import "dotenv/config";

/**
 * Allowed CORS origins parsed from environment variable.
 * @constant {string[]}
 */
const origins = (process.env.ORIGIN ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

/**
 * Socket.IO server instance configured with CORS settings.
 * @constant {Server}
 */
const io = new Server({
  cors: {
    origin: origins,
  },
});

/**
 * Global online users list (not room-specific).
 * @type {Array<{socketId: string, userId: string}>}
 */
let onlineUsers: { socketId: string; userId: string }[] = [];

/**
 * Room-based user tracking. Maps roomId to array of users in that room.
 * @type {Record<string, Array<{socketId: string, username: string}>>}
 */
const rooms: Record<string, { socketId: string; username: string }[]> = {};

/**
 * Handles new WebSocket connections.
 * Sets up event listeners for user authentication, room management, messaging, and disconnection.
 * @listens connection
 * @param {Socket} socket - The connected socket instance
 */
io.on("connection", (socket: Socket) => {
  console.log("User connected:", socket.id);

  // Agregamos usuario global
  onlineUsers.push({ socketId: socket.id, userId: "" });
  io.emit("usersOnline", onlineUsers);

  /**
   * Identifies a global user by their userId.
   * Updates the user's information in the global online users list.
   * @event newUser
   * @param {string} userId - The unique identifier for the user
   * @emits usersOnline - Broadcasts updated list of online users
   */
  socket.on("newUser", (userId: string) => {
    if (!userId) return;

    const index = onlineUsers.findIndex(u => u.socketId === socket.id);

    if (index !== -1) {
      onlineUsers[index].userId = userId;
    } else {
      onlineUsers.push({ socketId: socket.id, userId });
    }

    io.emit("usersOnline", onlineUsers);
  });

  /**
   * Handles user joining a meeting room.
   * Adds the user to the room, stores their information, and notifies the backend.
   * @event joinRoom
   * @param {Object} params - Join room parameters
   * @param {string} params.roomId - The unique identifier for the room
   * @param {string} params.username - The user's display name
   * @param {string} params.email - The user's email address
   * @param {string} params.userId - The user's unique identifier
   * @emits roomUsers - Broadcasts updated list of users in the room
   */
  socket.on("joinRoom", async ({ roomId, username, email, userId }) => {
    try {
      socket.join(roomId);
      socket.data.username = username;
      socket.data.email = email;

      if (!rooms[roomId]) rooms[roomId] = [];

      rooms[roomId].push({
        socketId: socket.id,
        username,
      });

      console.log(`User ${username} joined room ${roomId}`);

      io.to(roomId).emit("roomUsers", rooms[roomId]);

      // Inform backend to persist participant email (best-effort)
      try {
        const backend = process.env.BACKEND_BASE || 'http://localhost:3000';
        if (email) {
          const url = `${backend.replace(/\/+$/,'')}/api/meetings/${encodeURIComponent(roomId)}/participants`;
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, userId, name: username })
          });
        }
      } catch (e) {
        console.warn('[chat] failed to persist participant to backend', e);
      }
    } catch (e) {
      console.warn('[chat] joinRoom handler error', e);
    }
  });

  /**
   * Handles user leaving a meeting room.
   * Removes the user from the room and updates all participants.
   * @event leaveRoom
   * @param {string} roomId - The unique identifier for the room to leave
   * @emits roomUsers - Broadcasts updated list of users in the room
   */
  socket.on("leaveRoom", (roomId: string) => {
    socket.leave(roomId);

    if (rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(u => u.socketId !== socket.id);
      io.to(roomId).emit("roomUsers", rooms[roomId]);
    }

    console.log(`User left room ${roomId}`);
  });

  /**
   * Handles sending chat messages within a room.
   * Broadcasts the message to all room participants and persists it to transcript files.
   * @event sendMessage
   * @param {Object} params - Message parameters
   * @param {string} params.roomId - The room to send the message to
   * @param {string} params.user - The username of the sender
   * @param {string} params.text - The message content
   * @emits message - Broadcasts the message to all users in the room
   */
  socket.on("sendMessage", ({ roomId, user, text }) => {
    io.to(roomId).emit("message", {
      id: crypto.randomUUID(),
      user,
      text,
      timestamp: new Date(),
    });
    // Also append chat message to transcripts so chat is included in meeting transcript
    try {
      const fs = require('fs');
      const path = require('path');
      // Prefer an explicit TRANSCRIPTS_DIR env var. If not provided, prefer the migrated AgoraX_resume path
      // so chat messages land in the same transcripts directory the resume service reads.
      const defaultCandidates = [
        path.join(process.cwd(), '..', 'AgoraX_resume', 'tmp', 'transcripts'),
        path.join(process.cwd(), '..', 'agoraX_back', 'tmp', 'transcripts')
      ];
      let transcriptsDir = process.env.TRANSCRIPTS_DIR || '';
      if (!transcriptsDir) {
        // choose the first candidate that exists, otherwise use the first candidate
        const found = defaultCandidates.find(p => require('fs').existsSync(p));
        transcriptsDir = found || defaultCandidates[0];
      }
      if (!fs.existsSync(transcriptsDir)) fs.mkdirSync(transcriptsDir, { recursive: true });
      const safeUser = String(user || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '_');
      const safeRoom = String(roomId || 'global').replace(/[^a-zA-Z0-9-_]/g, '_');
      const transcriptFile = path.join(transcriptsDir, `transcript-${safeRoom}-${safeUser}.txt`);
      // Write chat lines prefixed with (chat) so the resume service can detect and preserve names
      const entry = `[${new Date().toISOString()}] (chat) ${user}: ${text}\n`;
      fs.appendFile(transcriptFile, entry, (err: any) => { if (err) console.warn('Failed to append chat to transcript', err); });
    } catch (e) {
      console.warn('Failed adding chat to transcripts', e);
    }
  });

  /**
   * Handles client disconnection.
   * Removes the user from all rooms and the global online users list.
   * @event disconnect
   * @emits roomUsers - Broadcasts updated user lists for affected rooms
   * @emits usersOnline - Broadcasts updated global online users list
   */
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // eliminar usuario de todas las rooms
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(u => u.socketId !== socket.id);
      io.to(roomId).emit("roomUsers", rooms[roomId]);
    }

    // eliminar usuario global
    onlineUsers = onlineUsers.filter(u => u.socketId !== socket.id);
    io.emit("usersOnline", onlineUsers);
  });
});

/**
 * Server port number from environment variables.
 * @constant {number}
 */
const port = Number(process.env.PORT);
io.listen(port);
console.log(`Server running on port ${port}`);

