import { useEffect, useMemo } from "react";
import { io } from "socket.io-client";
import { SocketContext } from "./Socket";

export function SocketProvider({ children }) {
    const socket = useMemo(() => io("http://localhost:5000", {
        autoConnect: false,
    }), []);

    useEffect(() => {
        socket.connect();

        return () => {
            socket.disconnect();
        };
    }, [socket]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
}
