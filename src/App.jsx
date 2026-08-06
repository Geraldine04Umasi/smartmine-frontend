import { useEffect, useState } from "react";
import { API_BASE, useMetrics, useSimState } from "./useSimState";
import MineMap, { ESTADO_COLOR } from "./MineMap";

const ESTADO_LABEL = {
  idle: "Libre",
  hauling: "En ruta",
  loading: "Cargando",
  dumping: "Descargando",
};

function useGraph() {
  const [graph, setGraph] = useState({ nodos: [], aristas: [] });
  useEffect(() => {
    fetch("/mine_graph.json")
      .then((r) => r.json())
      .then(setGraph)
      .catch(() => {});
  }, []);
  return graph;
}

function MetricCard({ label, value, suffix }) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-3xl font-bold text-white">
        {value}
        {suffix && <span className="text-lg text-slate-400 ml-1">{suffix}</span>}
      </span>
    </div>
  );
}

function SpeedControl({ speed, setSpeed }) {
  const options = [1, 5, 20];
  const changeSpeed = (mult) => {
    setSpeed(mult);
    fetch(`${API_BASE}/speed/${mult}`, { method: "POST" }).catch(() => {});
  };
  return (
    <div className="flex gap-2">
      {options.map((mult) => (
        <button
          key={mult}
          onClick={() => changeSpeed(mult)}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
            speed === mult ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          {mult}x
        </button>
      ))}
    </div>
  );
}

function EstadoLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-400">
      {Object.entries(ESTADO_LABEL).map(([estado, label]) => (
        <span key={estado} className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: ESTADO_COLOR[estado] }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

function ShovelQueueTable({ shovels }) {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h2 className="text-slate-300 font-semibold mb-3">Colas por pala</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 text-left">
            <th className="pb-2">Pala</th>
            <th className="pb-2">Cola</th>
            <th className="pb-2">Ocupación</th>
          </tr>
        </thead>
        <tbody>
          {shovels.map((s) => (
            <tr key={s.id} className="border-t border-slate-700">
              <td className="py-2 text-white">{s.id}</td>
              <td className="py-2 text-slate-300">
                {s.cola_actual.length ? s.cola_actual.join(", ") : "—"}
              </td>
              <td className="py-2 text-slate-300">
                {s.cola_actual.length}/{s.capacidad_cola}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const { trucks, shovels } = useSimState();
  const metrics = useMetrics();
  const graph = useGraph();
  const [speed, setSpeed] = useState(1);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SmartMine AI</h1>
          <p className="text-slate-400 text-sm">Flota simulada en tiempo real</p>
        </div>
        <SpeedControl speed={speed} setSpeed={setSpeed} />
      </header>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Espera promedio" value={metrics.tiempo_espera_promedio} suffix="min" />
        <MetricCard label="Ciclo promedio" value={metrics.tiempo_ciclo_promedio} suffix="min" />
        <MetricCard label="Ciclos completados" value={metrics.ciclos_completados} />
        <MetricCard label="Camiones activos" value={metrics.camiones_activos} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 flex flex-col gap-2">
          <div className="aspect-[4/3]">
            <MineMap graph={graph} trucks={trucks} shovels={shovels} />
          </div>
          <EstadoLegend />
        </div>
        <ShovelQueueTable shovels={shovels} />
      </div>
    </div>
  );
}
