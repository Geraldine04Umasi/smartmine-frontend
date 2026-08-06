import { Link } from "react-router-dom";
import Logo from "../components/Logo";

function ModuleCard({ to, title, description, accent }) {
  return (
    <Link
      to={to}
      className="group flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col gap-4 hover:border-slate-600 transition-colors"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
        style={{ backgroundColor: accent }}
      >
        {title[0]}
      </div>
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <p className="text-slate-400 text-sm flex-1">{description}</p>
      <span className="text-sm font-semibold text-purple-400 group-hover:text-purple-300">
        Entrar →
      </span>
    </Link>
  );
}

export default function ModuleSelector() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 gap-10">
      <div className="text-center flex flex-col items-center gap-2">
        <Logo className="h-20 w-auto" />
        <h1 className="text-4xl font-bold">SmartMine AI</h1>
        <p className="text-slate-400 mt-2">Elige un módulo para comenzar</p>
      </div>
      <div className="flex flex-col md:flex-row gap-6 w-full max-w-3xl">
        <ModuleCard
          to="/simulacion"
          title="Simulación"
          description="Observa la flota preconfigurada operar en tiempo real sobre el mapa de la mina, con asignación óptima de camiones y métricas en vivo."
          accent="#3b82f6"
        />
        <ModuleCard
          to="/constructor"
          title="Constructor"
          description="Diseña tu propio layout de mina — nodos, palas, estación de descarga y camiones — y simúlalo, inyectando fallas en tiempo real."
          accent="#a855f7"
        />
      </div>
    </div>
  );
}
