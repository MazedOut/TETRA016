/**
 * Backward-compatibility shim.
 * All auth logic now lives in AuthContext. This file re-exports the hook so
 * components that still import from here don't need changes.
 */
export { useMode, AuthProvider as ModeProvider } from "./AuthContext.jsx";
export { useAuth } from "./AuthContext.jsx";
