import { useRef, useCallback, useEffect, useState } from "react";

export default function useWebRTC(socket) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  // State refs for stability
  const iceQueueRef = useRef([]);
  const isRemoteSetRef = useRef(false);
  const isInitiatedRef = useRef(false);

  // Connection state for UI
  const [connectionState, setConnectionState] = useState("new");

  // 🧹 Cleanup Function
  const cleanup = useCallback(() => {
    console.log("🧹 WebRTC Cleanup Triggered");

    // 1. Stop Media Tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log("🛑 Track stopped:", track.kind);
      });
      streamRef.current = null;
    }

    // 2. Close Peer
    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.oniceconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    // 3. Reset Refs
    iceQueueRef.current = [];
    isRemoteSetRef.current = false;
    isInitiatedRef.current = false;

    // 4. Clear Video Elements (optional, depends on UI needs)
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    // 5. Remove specific listeners if they were attached manually? 
    // Actually, we use useEffect for listeners, so they clean up themselves.
    // But if we want to be safe or if we are using this outside a component, we might want to manually off them.
    // However, since we use useEffect for socket listeners, we don't need to manually off them here strictly speaking,
    // BUT the requirement says "Remove listeners".
    // The `useEffect` below handles socket listener removal on unmount/dep change.
    // Explicit removal here might be redundant if this is called on unmount, but good for "Stop" button.
    if (socket) {
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    }

    setConnectionState("closed");
  }, [socket]);


  // 💧 Helper: Process Queued ICE
  const processIceQueue = useCallback(async () => {
    if (!peerRef.current || iceQueueRef.current.length === 0) return;

    console.log(`💧 Processing ${iceQueueRef.current.length} queued ICE candidates`);
    for (const candidate of iceQueueRef.current) {
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("❌ Queue Add Error:", err);
      }
    }
    iceQueueRef.current = [];
  }, []);

  // 🚀 Initialize WebRTC
  const initialize = useCallback(async (peerId, isCaller) => {
    if (isInitiatedRef.current) {
      console.warn("⚠️ Already initiated, skipping...");
      return;
    }
    isInitiatedRef.current = true;
    console.log(`🚀 Initializing WebRTC (Caller: ${isCaller})`);

    try {
      // 1. Create Peer Connection IMMEDIATELY
      peerRef.current = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Monitor Connection State
      peerRef.current.onconnectionstatechange = () => {
        console.log("📶 Connection State:", peerRef.current.connectionState);
        setConnectionState(peerRef.current.connectionState);
      };

      // Monitor ICE State
      peerRef.current.oniceconnectionstatechange = () => {
        console.log("🧊 ICE Connection State:", peerRef.current.iceConnectionState);
      };

      // Handle ICE Candidates
      peerRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          // STRICT: Send raw candidate object
          const candidateData = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          };
          socket.emit("ice-candidate", {
            candidate: candidateData,
            to: peerId
          });
        }
      };

      // Handle Remote Stream
      peerRef.current.ontrack = (event) => {
        console.log("🎥 Remote track received");
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // 2. Get User Media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      streamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // 3. Add Tracks to Peer
      stream.getTracks().forEach(track => {
        peerRef.current.addTrack(track, stream);
      });

      // 4. Create Offer (if caller)
      if (isCaller) {
        console.log("📝 Creating Offer");
        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);
        socket.emit("offer", { offer, to: peerId });
      }

    } catch (err) {
      console.error("❌ Initialization Error:", err);
      cleanup();
    }
  }, [socket, cleanup]);

  // 📨 Handle Incoming Offer
  // Note: This needs to be stable reference for useEffect
  const handleOffer = useCallback(async ({ offer, from }) => {
    console.log("📨 Received Offer");
    if (!peerRef.current) {
      console.warn("⚠️ Received offer but peerRef is null");
      return;
    }

    try {
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      isRemoteSetRef.current = true;
      console.log("✅ Remote Description Set (Offer)");
      processIceQueue(); // drain queue

      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);

      socket.emit("answer", { answer, to: from });
    } catch (err) {
      console.error("❌ Handle Offer Error:", err);
    }
  }, [socket, processIceQueue]);


  // 📨 Handle Incoming Answer
  const handleAnswer = useCallback(async ({ answer }) => {
    console.log("📨 Received Answer");
    if (!peerRef.current) {
      console.warn("⚠️ Received answer but peerRef is null");
      return;
    }

    try {
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      isRemoteSetRef.current = true;
      console.log("✅ Remote Description Set (Answer)");
      processIceQueue(); // drain queue
    } catch (err) {
      console.error("❌ Handle Answer Error:", err);
    }
  }, [processIceQueue]);


  // 🧊 Handle Incoming ICE Candidate
  const handleRemoteCandidate = useCallback(async (data) => {
    if (!peerRef.current) return;

    // Extract raw candidate
    // The requirement says "Frontend must expect RAW candidate object only"
    // So we expect data.candidate to be the object { candidate, sdpMid, sdpMLineIndex }
    // OR if the backend forwards it as-is, `data` might be the object wrapper with `candidate` inside?
    // Let's assume the payload from socket is { candidate: { ...raw... } } or just { ...raw... }?
    // The requirement says: "Only accept: { candidate: string, sdpMid: string, sdpMLineIndex: number }"
    // usually socket.on("ice-candidate", (data) => ...) receives what was emitted.
    // If we emit { candidate: raw, to: peerId }, the other side receives { candidate: raw, from: ... } probably?
    // Let's handle both cases to be safe but strictly validate structure.

    let candidateObj = data.candidate || data;

    // STRICT VALIDATION
    if (!candidateObj || !candidateObj.candidate || candidateObj.candidate === "") {
      console.warn("⚠️ Ignoring invalid or empty ICE candidate", candidateObj);
      return;
    }

    if (!isRemoteSetRef.current) {
      console.log("🧊 Queueing ICE Candidate (Remote Desc not set)");
      iceQueueRef.current.push(candidateObj);
      return;
    }

    try {
      await peerRef.current.addIceCandidate(new RTCIceCandidate(candidateObj));
      console.log("✅ Added ICE Candidate");
    } catch (err) {
      console.error("❌ Add ICE Error:", err);
    }
  }, []);


  // 🚫 Handle Partner Left
  const handlePartnerLeft = useCallback(() => {
    console.log("🚫 Partner Left (WebRTC Hook)");
    cleanup();
  }, [cleanup]);

  // 👂 Bind Socket Listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleRemoteCandidate);
    socket.on("partner-left", handlePartnerLeft);

    return () => {
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleRemoteCandidate);
      socket.off("partner-left", handlePartnerLeft);
    };
  }, [socket, handleOffer, handleAnswer, handleRemoteCandidate, handlePartnerLeft]);


  return {
    localVideoRef,
    remoteVideoRef,
    initialize,
    cleanup,
    connectionState
  };
}
