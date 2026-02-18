import { useState } from "react";
import { AppStateContext } from "./AppState";

export function AppStateProvider({ children }) {
  const [status, setStatus] = useState("idle");
  const [matchDetails, setMatchDetails] = useState(null);

  const resetState = () => {
    setStatus("idle");
    setMatchDetails(null);
  };

  return (
    <AppStateContext.Provider value={{ status, setStatus, matchDetails, setMatchDetails, resetState }}>
      {children}
    </AppStateContext.Provider>
  );
}
