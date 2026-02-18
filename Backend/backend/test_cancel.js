const io = require("socket.io-client");

const socket = io("http://localhost:5000");

socket.on("connect", () => {
    console.log("Connected with ID:", socket.id);

    console.log("Emitting 'join'...");
    socket.emit("join");

    setTimeout(() => {
        console.log("Emitting 'cancel'...");
        socket.emit("cancel");
    }, 1000);

    setTimeout(() => {
        console.log("Disconnecting...");
        socket.disconnect();
    }, 2000);
});

socket.on("disconnect", () => {
    console.log("Disconnected");
});
