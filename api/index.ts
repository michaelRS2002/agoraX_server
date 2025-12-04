import { Server, type Socket } from "socket.io";
import "dotenv/config";

const origins = (process.env.ORIGIN ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const io = new Server({
  cors: {
    origin: origins,
  },
});

// Usuarios globales (no por sala)
let onlineUsers: { socketId: string; userId: string }[] = [];

// Usuarios por sala
const rooms: Record<string, { socketId: string; username: string }[]> = {};

io.on("connection", (socket: Socket) => {
  console.log("User connected:", socket.id);

  // Agregamos usuario global
  onlineUsers.push({ socketId: socket.id, userId: "" });
  io.emit("usersOnline", onlineUsers);

  // ──────────────────────────────
  // 🔵 Identificar usuario global
  // ──────────────────────────────
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

  // ──────────────────────────────
  // 🔵 JOIN ROOM (recibe username)
  // ──────────────────────────────
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

  // ──────────────────────────────
  // 🔵 LEAVE ROOM
  // ──────────────────────────────
  socket.on("leaveRoom", (roomId: string) => {
    socket.leave(roomId);

    if (rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(u => u.socketId !== socket.id);
      io.to(roomId).emit("roomUsers", rooms[roomId]);
    }

    console.log(`User left room ${roomId}`);
  });

  // ──────────────────────────────
  // 🔵 MENSAJES
  // ──────────────────────────────
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

  // ──────────────────────────────
  // 🔴 DESCONEXIÓN
  // ──────────────────────────────
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

const port = Number(process.env.PORT);
io.listen(port);
console.log(`Server running on port ${port}`);

