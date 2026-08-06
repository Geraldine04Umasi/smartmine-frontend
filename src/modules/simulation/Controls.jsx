import { useState } from "react";
import { startSim, stopSim, resetSim } from "../../useSimState";
import SpeedControl from "../../components/SpeedControl";

export default function Controls({ session = "default", running, setRunning }) {
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);

  const handleToggle = async () => {
    setBusy(true);
    try {
      if (running) {
        await stopSim(session);
        setRunning(false);
      } else {
        await startSim(session);
        setRunning(true);
      }
    } catch {
      // conexion caida, no bloquear la UI
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    try {
      await resetSim(session);
      setSpeed(1);
      setRunning(false);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleToggle}
        disabled={busy}
        className={`px-4 py-1.5 rounded-md text-sm font-semibold text-white disabled:opacity-50 ${
          running ? "bg-amber-600 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-500"
        }`}
      >
        {running ? "⏸ Pausar" : "▶ Iniciar"}
      </button>
      <button
        onClick={handleReset}
        disabled={busy}
        className="px-4 py-1.5 rounded-md text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-50"
      >
        ⟲ Reset
      </button>
      <SpeedControl speed={speed} setSpeed={setSpeed} session={session} />
    </div>
  );
}
