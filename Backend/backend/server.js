const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const MatchManager = require("./socket/MatchManager");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const matchManager = new MatchManager(io);

io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  // 1. Match Logic
  socket.on("find-match", () => {
    matchManager.handleFindMatch(socket);
  });

  // 2. Manual Leave / Next
  socket.on("next", () => {
    // Treat 'next' as leaving current room + finding new one
    matchManager.handleLeave(socket);
    matchManager.handleFindMatch(socket);
  });

  // 3. Disconnect Handling
  socket.on("disconnect", () => {
    matchManager.handleDisconnect(socket);
  });

  // 4. Explicit Cancel (optional but good for UI 'Cancel' button)
  socket.on("cancel", () => {
    matchManager.handleLeave(socket);
  });

  // 5. WebRTC Signaling
  // Requirement: Forward specific events
  socket.on("offer", (payload) => matchManager.handleOffer(socket, payload));
  socket.on("answer", (payload) => matchManager.handleAnswer(socket, payload));

  // Requirement: socket.on("ice-candidate", ({ candidate, to }))
  socket.on("ice-candidate", (payload) => matchManager.handleIceCandidate(socket, payload));
});

const PORT = process.env.PORT || 5000;

const serverInstance = server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

serverInstance.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error("Server error:", err);
  }
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down server...");
  serverInstance.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});

