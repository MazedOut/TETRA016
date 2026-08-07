import MsmeCountdown from "../components/MsmeCountdown.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function MsmeTrackerPage() {
  const { mode } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-paper">MSME 45-Day Payment Tracker</h2>
        <p className="text-sm text-paper/50 mt-1 font-sans">
          {mode === "msme"
            ? "Track your invoice payment deadlines to avoid Section 43B(h) penalties"
            : "Monitor MSME payment compliance and Section 43B(h) exposure"}
        </p>
      </div>
      <MsmeCountdown />
    </div>
  );
}
