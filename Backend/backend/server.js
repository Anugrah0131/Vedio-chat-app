require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const authRoutes = require("./routes/authRoutes");
const MatchManager = require("./socket/MatchManager");

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const matchManager = new MatchManager(io);

// DB Connection
mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/videochat")
.then(() => console.log("MongoDB connected"))
.catch((err) => console.log("MongoDB connection error:", err));

io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  socket.on("user:join", (data) => {
    if (!data) return;
    if (data.token) {
      try {
        const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
        socket.user = {
          userId: decoded.userId,
          username: decoded.username,
          isGuest: false
        };
      } catch (err) {
        socket.user = {
          userId: data.userId,
          username: data.username || `guest_${data.userId.substring(0, 4)}`,
          isGuest: true
        };
      }
    } else {
      socket.user = {
        userId: data.userId,
        username: data.username || `guest_${data.userId.substring(0, 4)}`,
        isGuest: true
      };
    }
    console.log(`User mapped on socket: ${socket.user.username}`);
  });

  socket.on("find-match", () => matchManager.handleFindMatch(socket));
  socket.on("next", () => {
    matchManager.handleLeave(socket);
    matchManager.handleFindMatch(socket);
  });
  socket.on("disconnect", () => matchManager.handleDisconnect(socket));
  socket.on("cancel", () => matchManager.handleLeave(socket));
  
  socket.on("offer", (payload) => matchManager.handleOffer(socket, payload));
  socket.on("answer", (payload) => matchManager.handleAnswer(socket, payload));
  socket.on("ice-candidate", (payload) => matchManager.handleIceCandidate(socket, payload));
});

const PORT = process.env.PORT || 5000;
const serverInstance = server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

serverInstance.on("error", (err) => {
  if (err.code === "EADDRINUSE") console.error(`Port ${PORT} is already in use.`);
  else console.error("Server error:", err);
});

process.on("SIGINT", () => {
  console.log("Shutting down server...");
  serverInstance.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});

