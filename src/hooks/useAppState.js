import { useContext } from "react";
import { AppStateContext } from "../context/AppState";

export default function useAppState() {
    return useContext(AppStateContext);
}
