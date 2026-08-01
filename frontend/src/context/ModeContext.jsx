import { createContext, useContext, useState } from "react";

const ModeContext = createContext({
  mode: "auditor", // "auditor" | "msme"
  setMode: () => {},
});

export function ModeProvider({ children }) {
  const [mode, setMode] = useState("auditor");

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
