import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useSocket from "../hooks/useSocket";
import useAppState from "../hooks/useAppState";
export default function Home() {
  const socket = useSocket();
  const { status, setStatus, setMatchDetails } = useAppState();
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) return;

    const handleMatchFound = ({ peerId, isCaller }) => {
      console.log("✅ MATCH FOUND in Home:", peerId, isCaller);
      setStatus("matched");
      setMatchDetails({ peerId, isCaller });
      navigate("/room");
    };

    socket.on("match-found", handleMatchFound);

    return () => {
      socket.off("match-found", handleMatchFound);
    };
  }, [socket, setStatus, setMatchDetails, navigate]);

  const findMatch = () => {
    if (!socket) return;
    setStatus("searching");
    socket.emit("join");
  };

const cancelSearch = () => {
  socket.emit("cancel");
  setStatus("idle");
};


  return (
    <div className="h-screen flex flex-col items-center justify-center bg-black text-white p-4">
      <h1 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
        Omegle Clone
      </h1>

      {status === "idle" && (
        <button
          onClick={findMatch}
          className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full text-xl font-semibold hover:scale-105 transition-transform shadow-lg hover:shadow-purple-500/50"
        >
          Find Match
        </button>
      )}

      {status === "searching" && (
        <div className="flex flex-col items-center gap-4">
          <div className="text-2xl animate-pulse text-purple-300">
            🔍 Looking for someone...
          </div>
          <button
            onClick={cancelSearch}
            className="px-6 py-2 border border-gray-600 rounded-full text-gray-400 hover:text-white hover:border-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {status === "disconnected" && (
        <div className="text-center">
          <p className="text-xl text-gray-400 mb-6">Partner disconnected</p>
          <button
            onClick={findMatch}
            className="px-8 py-3 bg-blue-600 rounded-full text-lg font-semibold hover:bg-blue-500 transition-colors"
          >
            Find New Match
          </button>
        </div>
      )}
    </div>
  );
}
