import { useState } from "react";
import { Link } from "react-router-dom";
import Toolbar from "./Toolbar";
import BuilderCanvas from "./BuilderCanvas";
import EventPanel from "./EventPanel";
import { useBuilderState } from "./useBuilderState";
import { createCustomSession, startSim, useLiveSession } from "../../useSimState";
import SimCanvas from "../simulation/SimCanvas";
import Controls from "../simulation/Controls";
import MetricCard from "../../components/MetricCard";
import EstadoLegend from "../../components/EstadoLegend";
import ShovelQueueTable from "../../components/ShovelQueueTable";

export default function BuilderView() {
  const builder = useBuilderState();
  const [tool, setTool] = useState("nodo");
  const [autoConnect, setAutoConnect] = useState(false);
  const [mode, setMode] = useState("design"); // design | simulate
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [running, setRunning] = useState(true);
  const [faults, setFaults] = useState({ trucks: new Set(), shovels: new Set(), edges: new Set() });

  const { trucks, shovels, metricas: metrics, graph } = useLiveSession("custom", mode === "simulate");

  const handleSimulate = async () => {
    if (!builder.validation.valid) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await createCustomSession(builder.toPayload());
      await startSim("custom");
      setFaults({ trucks: new Set(), shovels: new Set(), edges: new Set() });
      setRunning(true);
      setMode("simulate");
    } catch {
      setSubmitError("No se pudo crear la simulación. Revisa el diseño e intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === "simulate") {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">SmartMine AI</h1>
            <p className="text-slate-400 text-sm">Módulo 2 — Constructor (simulando)</p>
          </div>
          <div className="flex items-center gap-4">
            <Controls session="custom" running={running} setRunning={setRunning} />
            <button
              onClick={() => setMode("design")}
              className="text-sm text-slate-300 hover:text-white bg-slate-800 px-3 py-1.5 rounded-md"
            >
              ✎ Volver a diseñar
            </button>
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
              <SimCanvas graph={graph} trucks={trucks} shovels={shovels} faults={faults} />
            </div>
            <EstadoLegend />
          </div>
          <div className="flex flex-col gap-4">
            <EventPanel trucks={trucks} shovels={shovels} graph={graph} setFaults={setFaults} />
            <ShovelQueueTable shovels={shovels} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SmartMine AI</h1>
          <p className="text-slate-400 text-sm">Módulo 2 — Constructor de mina</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSimulate}
            disabled={!builder.validation.valid || submitting}
            className="px-4 py-1.5 rounded-md text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Creando..." : "▶ Simular"}
          </button>
          <Link to="/" className="text-slate-500 text-sm hover:text-slate-300">
            ← Módulos
          </Link>
        </div>
      </header>

      <div className="flex gap-6">
        <Toolbar tool={tool} setTool={setTool} autoConnect={autoConnect} setAutoConnect={setAutoConnect} />
        <div className="flex flex-col gap-3">
          <BuilderCanvas builder={builder} tool={tool} autoConnect={autoConnect} />
          {!builder.validation.valid && (
            <ul className="text-sm text-amber-400 list-disc list-inside">
              {builder.validation.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}
          {submitError && <p className="text-sm text-red-400">{submitError}</p>}
        </div>
      </div>
    </div>
  );
}
