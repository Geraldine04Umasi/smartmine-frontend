import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveSession, startSim } from "../../useSimState";
import SimCanvas from "./SimCanvas";
import Controls from "./Controls";
import MetricCard from "../../components/MetricCard";
import EstadoLegend from "../../components/EstadoLegend";
import ShovelQueueTable from "../../components/ShovelQueueTable";
import AvisosPanel from "../../components/AvisosPanel";
import AhorroBadge from "../../components/AhorroBadge";

function StartScreen({ onStart, starting }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold">SmartMine AI</h1>
        <p className="text-slate-400 mt-2">Módulo 1 — Simulación pre-construida</p>
      </div>
      <button
        onClick={onStart}
        disabled={starting}
        className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-lg disabled:opacity-50"
      >
        {starting ? "Iniciando..." : "▶ Iniciar Simulación"}
      </button>
      <Link to="/" className="text-slate-500 text-sm hover:text-slate-300">
        ← Volver
      </Link>
    </div>
  );
}

export default function SimulationView() {
  const [phase, setPhase] = useState("start"); // start | running
  const [starting, setStarting] = useState(false);
  const [running, setRunning] = useState(true);

  const { trucks, shovels, metricas: metrics, graph, avisos } = useLiveSession("default", phase === "running");

  const handleStart = async () => {
    setStarting(true);
    try {
      await startSim("default");
      setRunning(true);
      setPhase("running");
    } finally {
      setStarting(false);
    }
  };

  if (phase === "start") {
    return <StartScreen onStart={handleStart} starting={starting} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SmartMine AI</h1>
          <p className="text-slate-400 text-sm">Módulo 1 — Simulación en tiempo real</p>
        </div>
        <div className="flex items-center gap-4">
          <AhorroBadge minutos={metrics.tiempo_ahorrado_min} />
          <Controls session="default" running={running} setRunning={setRunning} />
          <Link to="/" className="text-slate-500 text-sm hover:text-slate-300">
            ← Módulos
          </Link>
        </div>
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
            <SimCanvas graph={graph} trucks={trucks} shovels={shovels} />
          </div>
          <EstadoLegend />
        </div>
        <div className="flex flex-col gap-4">
          <ShovelQueueTable shovels={shovels} />
          <AvisosPanel avisos={avisos} />
        </div>
      </div>
    </div>
  );
}
