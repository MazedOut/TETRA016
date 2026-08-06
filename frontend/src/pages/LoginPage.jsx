import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { ShieldCheck, User, Building } from "lucide-react";

const ROLE_INFO = {
  auditor: {
    icon: ShieldCheck,
    title: "Auditor",
    subtitle: "Full access — resolve tickets, edit invoices, manage folders",
    accent: "border-stamp-red",
    badge: "bg-stamp-red/15 text-stamp-red border-stamp-red/30",
  },
  msme: {
    icon: Building,
    title: "MSME / Vendor",
    subtitle: "Read-only — view flagged invoices and plain-language advice",
    accent: "border-stamp-green",
    badge: "bg-stamp-green/15 text-stamp-green border-stamp-green/30",
  },
};

export default function LoginPage() {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState("auditor");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    const ok = login(selectedRole, password);
    if (!ok) {
      setError("Incorrect password. Try again.");
      setShaking(true);
      setPassword("");
      setTimeout(() => setShaking(false), 600);
    }
  }

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center px-4">
      {/* Background grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #F6F1E4 1px, transparent 0)",
          backgroundSize: "5px 5px",
        }}
      />

      <div className="relative w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-xl bg-stamp-red/90 flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck size={28} strokeWidth={2.5} className="text-paper" />
          </div>
          <div>
            <h1 className="font-display text-4xl font-bold text-paper tracking-tight">
              TETRA
            </h1>
            <p className="text-paper/50 text-sm font-mono mt-1 tracking-wide uppercase">
              Invoice Risk Intelligence
            </p>
          </div>
        </div>

        {/* Login card */}
        <form
          onSubmit={handleSubmit}
          className={`bg-ink-800 rounded-2xl border border-ink-600/60 p-7 space-y-6 shadow-2xl transition-transform ${
            shaking ? "animate-[shake_0.4s_ease-in-out]" : ""
          }`}
        >
          {/* Role selection */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-paper/60 uppercase tracking-widest block">
              Sign in as
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["auditor", "msme"]).map((role) => {
                const info = ROLE_INFO[role];
                const active = selectedRole === role;
                const Icon = info.icon;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      setSelectedRole(role);
                      setError("");
                      setPassword("");
                    }}
                    className={`rounded-xl border-2 p-3.5 text-left transition-all duration-150 ${
                      active
                        ? `${info.accent} bg-ink-700/60 shadow-sm`
                        : "border-ink-600/40 hover:border-ink-600 hover:bg-ink-700/30"
                    }`}
                  >
                    <Icon
                      size={20}
                      strokeWidth={1.8}
                      className={`mb-2.5 ${active ? "text-paper" : "text-paper/50"}`}
                    />
                    <div className={`font-semibold text-sm ${active ? "text-paper" : "text-paper/70"}`}>
                      {info.title}
                    </div>
                    <div className="text-paper/50 text-[10px] font-mono leading-tight mt-1">
                      {info.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="login-password"
              className="text-xs font-mono text-paper/60 uppercase tracking-widest block"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder={`${ROLE_INFO[selectedRole].title} password`}
              className="w-full bg-ink border border-ink-600/50 rounded-lg px-4 py-3
                         text-paper font-mono text-sm placeholder-paper/25
                         focus:outline-none focus:border-paper/40 transition-colors"
            />
            {error && (
              <p className="text-stamp-red text-xs font-mono mt-1">{error}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!password}
            className={`w-full py-3 rounded-lg font-semibold text-sm transition-all shadow-sm ${
              selectedRole === "auditor"
                ? "bg-stamp-red hover:bg-stamp-red/90 text-paper disabled:opacity-40"
                : "bg-stamp-green hover:bg-stamp-green/90 text-paper disabled:opacity-40"
            } disabled:cursor-not-allowed`}
          >
            Sign in as {ROLE_INFO[selectedRole].title}
          </button>

          {/* Role capability badge */}
          <div className={`rounded-lg border px-4 py-3 text-[11px] font-mono ${ROLE_INFO[selectedRole].badge}`}>
            {selectedRole === "auditor" ? (
              <>
                <span className="font-bold block mb-0.5">Auditor access includes:</span>
                Resolve/merge/escalate tickets · Edit invoice fields · Create
                and manage folders · Full audit trail
              </>
            ) : (
              <>
                <span className="font-bold block mb-0.5">MSME access includes:</span>
                View your flagged invoices · Read plain-language explanations ·
                No modification rights
              </>
            )}
          </div>
        </form>

        {/* Security disclaimer */}
        <p className="text-center text-paper/25 text-[10px] font-mono leading-relaxed max-w-sm mx-auto flex items-center justify-center gap-1.5">
          <User size={12} strokeWidth={2} className="shrink-0" />
          <span>
            Demo-grade access control — passwords are shared and validated
            client-side. Role is enforced via X-Role header.
          </span>
        </p>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}
