import { useState } from "react";
import { toggleRoad, toggleShovel, removeTruck } from "../../useSimState";

function uniqueRoads(aristas) {
  const seen = new Set();
  const out = [];
  for (const e of aristas || []) {
    const key = [e.from, e.to].sort().join("-");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, from: e.from, to: e.to });
  }
  return out;
}

export default function EventPanel({ trucks, shovels, graph, setFaults }) {
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const roads = uniqueRoads(graph.aristas);

  const inject = async () => {
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      const [kind, id] = target.split(":");
      if (kind === "truck") {
        await removeTruck(id, "custom");
        setFaults((f) => ({ ...f, trucks: new Set([...f.trucks, id]) }));
      } else if (kind === "shovel") {
        await toggleShovel(id, "custom");
        setFaults((f) => ({ ...f, shovels: new Set([...f.shovels, id]) }));
      } else if (kind === "road") {
        const [a, b] = id.split("-");
        await toggleRoad(a, b, "custom");
        setFaults((f) => ({ ...f, edges: new Set([...f.edges, id]) }));
      }
      setTarget("");
    } catch {
      setError("No se pudo aplicar el evento.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 flex flex-col gap-3">
      <h2 className="text-slate-200 font-semibold">⚡ Inyectar Evento</h2>
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200"
      >
        <option value="">Seleccionar elemento...</option>
        <optgroup label="Camión — avería mecánica">
          {trucks.map((t) => (
            <option key={t.id} value={`truck:${t.id}`}>
              {t.id}
            </option>
          ))}
        </optgroup>
        <optgroup label="Pala — falla / capacidad reducida">
          {shovels.map((s) => (
            <option key={s.id} value={`shovel:${s.id}`}>
              {s.id}
            </option>
          ))}
        </optgroup>
        <optgroup label="Ruta — bloqueada">
          {roads.map((r) => (
            <option key={r.key} value={`road:${r.key}`}>
              {r.from} → {r.to}
            </option>
          ))}
        </optgroup>
      </select>
      <button
        onClick={inject}
        disabled={!target || busy}
        className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-md"
      >
        {busy ? "Inyectando..." : "Simular falla"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
