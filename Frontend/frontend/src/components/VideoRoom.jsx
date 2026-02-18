import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useSocket from "../hooks/useSocket";
import useWebRTC from "../hooks/useWebRTC";
import useAppState from "../hooks/useAppState";

export default function VideoRoom() {
  const socket = useSocket();
  const { setStatus, matchDetails, setMatchDetails } = useAppState();
  const navigate = useNavigate();

  const {
    localVideoRef,
    remoteVideoRef,
    initialize,
    cleanup,
    connectionState
  } = useWebRTC(socket);

  // 1. Initialize on Mount
  useEffect(() => {
    if (!matchDetails || !socket) {
      navigate("/");
      return;
    }

    // Start WebRTC logic
    initialize(matchDetails.peerId, matchDetails.isCaller);

    // Stop on Unmount
    return () => {
      cleanup();
    };
  }, [matchDetails, socket, navigate, initialize, cleanup]);


  // 2. Handle Partner Disconnect (UI Update)
  // Note: usageWebRTC handles the peer cleanup on "partner-left",
  // but we still need to update the UI state here.
  useEffect(() => {
    if (!socket) return;

    const handlePartnerLeft = () => {
      console.log("❌ Partner Left (UI)");
      // Cleanup is handled by hook's listener or unmount, but explicit call is safe via hook's idempotent cleanup
      // Check if we need to call cleanup? 
      // Components unmount will call cleanup.
      // But if we want to show "Disconnected" screen without unmounting?
      // The requirement "No auto-rematch" implies we might show a state.
      setStatus("disconnected");
      setMatchDetails(null);
    };

    socket.on("partner-left", handlePartnerLeft);
    return () => socket.off("partner-left", handlePartnerLeft);
  }, [socket, setStatus, setMatchDetails]);


  // 3. User Actions
  const handleNextMatch = () => {
    if (!socket) return;
    cleanup(); // Manual stop before next match

    socket.emit("next");
    setStatus("searching");
    navigate("/");
  };

  const handleStop = () => {
    cleanup();

    setStatus("idle");
    setMatchDetails(null);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-white font-bold text-lg">
          Connected with: <span className="text-blue-400">{matchDetails?.peerId}</span>
        </div>

        <div className="flex gap-4 items-center">
          {/* Connection Status Badge */}
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase
                ${connectionState === "connected" ? "bg-green-500/20 text-green-400" :
              connectionState === "failed" || connectionState === "closed" ? "bg-red-500/20 text-red-400" :
                "bg-yellow-500/20 text-yellow-400"}`}>
            {connectionState}
          </div>

          <button onClick={handleStop} className="text-red-500 font-semibold hover:text-red-400">
            Esc
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 justify-center items-center w-full max-w-6xl mx-auto">

        {/* Remote */}
        <div className="relative w-full md:w-1/2 aspect-video bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm backdrop-blur-sm">
            Stranger
          </div>
        </div>

        {/* Local */}
        <div className="relative w-full md:w-1/2 aspect-video bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-white text-sm backdrop-blur-sm">
            You
          </div>
        </div>

      </div>

      {/* Controls */}
      <div className="mt-6 flex justify-center gap-6">
        <button
          onClick={handleStop}
          className="px-8 py-3 bg-red-600/20 text-red-500 rounded-full font-bold hover:bg-red-600 hover:text-white transition-all border border-red-600/50"
        >
          Stop
        </button>
        <button
          onClick={handleNextMatch}
          className="px-8 py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-500 hover:scale-105 transition-all shadow-lg hover:shadow-blue-500/30"
        >
          Next Match
        </button>
      </div>
    </div>
  );
}
