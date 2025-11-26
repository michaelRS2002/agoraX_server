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
  socket.on("joinRoom", ({ roomId, username }) => {
    socket.join(roomId);
    socket.data.username = username;

    if (!rooms[roomId]) rooms[roomId] = [];

    rooms[roomId].push({
      socketId: socket.id,
      username,
    });

    console.log(`User ${username} joined room ${roomId}`);

    io.to(roomId).emit("roomUsers", rooms[roomId]);
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

