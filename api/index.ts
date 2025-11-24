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

let onlineUsers: { socketId: string; userId: string }[] = [];

io.on("connection", (socket: Socket) => {
  // Agregar usuario con socketId
  onlineUsers.push({ socketId: socket.id, userId: "" });
  io.emit("userOnline", onlineUsers);

  console.log(
    "A user connected with id:",
    socket.id,
    "there are now",
    onlineUsers.length,
    "online users"
  );

  // ──────────────────────────────
  // 🔵 Manejamos la identificación del usuario
  // ──────────────────────────────
  socket.on("newUser", (userId: string) => {
    if (!userId) return;

    const existingUserIndex = onlineUsers.findIndex(
      (user) => user.socketId === socket.id
    );

    if (existingUserIndex !== -1) {
      onlineUsers[existingUserIndex] = { socketId: socket.id, userId };
    } else if (!onlineUsers.some((user) => user.userId === userId)) {
      onlineUsers.push({ socketId: socket.id, userId });
    } else {
      onlineUsers = onlineUsers.map((user) =>
        user.userId === userId ? { socketId: socket.id, userId } : user
      );
    }

    io.emit("usersOnline", onlineUsers);
  });

  // ──────────────────────────────
  // 🔵 JOIN ROOM
  // ──────────────────────────────
  socket.on("joinRoom", (roomId: string) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);

    // notificar a otros en la sala
    socket.to(roomId).emit("userJoined", { socketId: socket.id });
  });

  // ──────────────────────────────
  // 🔵 LEAVE ROOM
  // ──────────────────────────────
  socket.on("leaveRoom", (roomId: string) => {
    socket.leave(roomId);
    console.log(`Socket ${socket.id} left room ${roomId}`);

    socket.to(roomId).emit("userLeft", { socketId: socket.id });
  });

  // ──────────────────────────────
  // 🔵 MENSAJES DENTRO DE UNA SALA
  // ──────────────────────────────
  socket.on("sendMessage", (data: { roomId: string; user: string; text: string }) => {
    console.log("Message received in room:", data);

    io.to(data.roomId).emit("message", {
      id: crypto.randomUUID(),
      user: data.user,
      text: data.text,
      timestamp: new Date(),
    });
  });

  // ──────────────────────────────
  // 🔴 DESCONEXIÓN
  // ──────────────────────────────
  socket.on("disconnect", () => {
    onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
    io.emit("usersOnline", onlineUsers);

    console.log(
      "A user disconnected with id:",
      socket.id,
      "there are now",
      onlineUsers.length,
      "online users"
    );
  });
});

const port = Number(process.env.PORT);
io.listen(port);
console.log(`Server running on port ${port}`);
