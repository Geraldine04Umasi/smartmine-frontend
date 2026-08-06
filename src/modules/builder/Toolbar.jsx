const TOOLS = [
  { id: "nodo", label: "Nodo", icon: "●" },
  { id: "pala", label: "Pala", icon: "⛏" },
  { id: "estacion", label: "Estación", icon: "▲" },
  { id: "camion", label: "Camión", icon: "🚚" },
  { id: "arista", label: "Arista", icon: "―" },
  { id: "borrar", label: "Borrar", icon: "✕" },
];

export default function Toolbar({ tool, setTool }) {
  return (
    <div className="flex flex-col gap-2 bg-slate-900 border border-slate-800 rounded-xl p-3 w-40 h-fit">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            tool === t.id ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <span className="w-4 text-center">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}
