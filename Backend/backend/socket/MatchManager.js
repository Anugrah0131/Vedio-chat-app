class MatchManager {
    constructor(io) {
        this.io = io;
        this.waitingQueue = []; // FIFO Queue of socket.id
        this.activeRooms = new Map(); // socket.id -> partner.id
    }

    // --- Core Matchmaking Logic ---

    // Requirement: When user emits "find-match"
    handleFindMatch(socket) {
        const socketId = socket.id;

        // Safety: Prevent duplicate queue entries
        if (this.waitingQueue.includes(socketId)) {
            console.log(`[WARN] ${socketId} already in waitingQueue`);
            return;
        }
        // Safety: Prevent matching if already in a room
        if (this.activeRooms.has(socketId)) {
            console.log(`[WARN] ${socketId} already in activeRooms`);
            return;
        }

        console.log(`[FIND-MATCH] ${socketId} looking for match.`);

        if (this.waitingQueue.length > 0) {
            // Requirement: Pop one user
            const partnerId = this.waitingQueue.shift();

            // Safety: Prevent matching with self (though queue logic should prevent this)
            if (partnerId === socketId) {
                this.waitingQueue.push(socketId);
                return;
            }

            // Get usernames
            const socket1 = this.io.sockets.sockets.get(socketId);
            const socket2 = this.io.sockets.sockets.get(partnerId);
            const user1Name = socket1?.user?.username || "Guest";
            const user2Name = socket2?.user?.username || "Guest";

            this.createRoom(socketId, partnerId, user1Name, user2Name);
        } else {
            // Requirement: Push socket
            this.waitingQueue.push(socketId);
            this.logState();
        }
    }

    createRoom(user1Id, user2Id, user1Name, user2Name) {
        console.log(`[MATCH] Creating room: ${user1Id} (${user1Name}) <-> ${user2Id} (${user2Name})`);

        // Requirement: Map both in activeRooms
        this.activeRooms.set(user1Id, user2Id);
        this.activeRooms.set(user2Id, user1Id);

        // Requirement: Emit match-found to both (including usernames)
        this.io.to(user1Id).emit("match-found", { peerId: user2Id, peerName: user2Name, isCaller: true });
        this.io.to(user2Id).emit("match-found", { peerId: user1Id, peerName: user1Name, isCaller: false });

        this.logState();
    }

    // --- Cleanup Logic ---

    // Requirement: Leave Handling
    handleLeave(socket) {
        const socketId = socket.id;
        let modified = false;

        // 1. Remove from waitingQueue
        const queueIndex = this.waitingQueue.indexOf(socketId);
        if (queueIndex !== -1) {
            this.waitingQueue.splice(queueIndex, 1);
            console.log(`[QUEUE] Removed ${socketId}`);
            modified = true;
        }

        // 2. If socket in activeRooms
        if (this.activeRooms.has(socketId)) {
            const partnerId = this.activeRooms.get(socketId);

            // Notify partner
            // Requirement: "No duplicate partner-left emits" - logic handles this because we delete mapping immediately
            if (partnerId) {
                this.io.to(partnerId).emit("partner-left", { reason: "left" });
                // Also remove partner from activeRooms immediately to prevent double handling
                this.activeRooms.delete(partnerId);
            }

            // Delete user from activeRooms
            this.activeRooms.delete(socketId);

            console.log(`[ROOM] Dissolved ${socketId} <-> ${partnerId}`);
            modified = true;
        }

        if (modified) this.logState();
    }

    handleDisconnect(socket) {
        console.log(`[DISCONNECT] ${socket.id}`);
        // Requirement: On disconnect, call handleLeave
        this.handleLeave(socket);
    }

    // --- ICE Handling ---

    // Requirement: Forward EXACTLY: io.to(to).emit("ice-candidate", candidate)
    handleIceCandidate(socket, payload) {
        // Payload expected: { candidate, to }
        const { candidate, to } = payload;

        if (!to || !candidate) {
            console.warn(`[ICE] Invalid payload from ${socket.id}:`, payload);
            return;
        }

        // Requirement: Do NOT modify structure. Forward EXACTLY.
        this.io.to(to).emit("ice-candidate", candidate);
    }

    // Relay other WebRTC events
    handleOffer(socket, payload) {
        // Payload: { offer, to } (implied need 'to' or verify partner based on rooms)
        // Since we have activeRooms, we can look up the partner if 'to' is not trustworthy or purely relying on server state.
        // However, standard signaling usually trusts the 'to' or expects server to validate.
        // Let's validate against activeRooms for security.

        const partnerId = this.activeRooms.get(socket.id);
        if (partnerId) {
            // Forward offer
            // Using { offer, from } wrapper is standard for offer/answer to identify source
            // checking requirements: "Return... Clean socket server code"
            // Requirement 3 only specified ICE handling strictness. 
            // Existing code wrapped offer/answer. Keeping that pattern for offer/answer unless specified otherwise.
            this.io.to(partnerId).emit("offer", { offer: payload.offer, from: socket.id });
        }
    }

    handleAnswer(socket, payload) {
        const partnerId = this.activeRooms.get(socket.id);
        if (partnerId) {
            this.io.to(partnerId).emit("answer", { answer: payload.answer, from: socket.id });
        }
    }

    // --- Logging ---

    logState() {
        console.log("--- STATE ---");
        console.log("Queue:", this.waitingQueue);
        console.log("Active Rooms:", this.activeRooms.size / 2); // pairs
        console.log("-------------");
    }
}

module.exports = MatchManager;
