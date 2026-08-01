/**
 * AuthContext — role-based access for the hackathon demo.
 *
 * SECURITY NOTE (shown on the login screen too):
 * Passwords are checked client-side; the backend reads an X-Role header on
 * write endpoints. This prevents accidental MSME access to audit actions but
 * is NOT cryptographically secure — it is explicitly demo-grade access control.
 */
import { createContext, useContext, useState, useCallback } from "react";
import { setClientRole } from "../api/client.js";


// Passwords are intentionally simple for the demo.
// Change here to configure; never store real credentials this way.
const PASSWORDS = {
  auditor: "audit2026",
  msme: "msme2026",
};

const AuthContext = createContext({
  role: null,       // "auditor" | "msme" | null
  isAuthenticated: false,
  canWrite: false,  // true only when role === "auditor"
  mode: "auditor",  // alias kept so old useMode() consumers still compile
  login: () => false,
  logout: () => {},
  setRole: () => {},
});

export function AuthProvider({ children }) {
  const [role, setRole] = useState(null);

  const login = useCallback((selectedRole, password) => {
    if (PASSWORDS[selectedRole] && password === PASSWORDS[selectedRole]) {
      setRole(selectedRole);
      setClientRole(selectedRole);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setRole(null);
    setClientRole(null);
  }, []);


  const value = {
    role,
    isAuthenticated: role !== null,
    canWrite: role === "auditor",
    mode: role ?? "auditor",   // backward-compat alias
    login,
    logout,
    setRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Primary hook for auth-aware components */
export function useAuth() {
  return useContext(AuthContext);
}

/** Backward-compat shim — old components that import useMode() keep working */
export function useMode() {
  const { mode, canWrite } = useContext(AuthContext);
  return { mode, canWrite };
}
