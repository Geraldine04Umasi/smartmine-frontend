const TIPO_INFO = {
  asignacion: { icon: "🚚", label: "Asignación", classes: "border-sky-500 bg-sky-500/10" },
  bloqueo: { icon: "🚧", label: "Ruta", classes: "border-amber-500 bg-amber-500/10" },
  reroute: { icon: "🔄", label: "Reruteo", classes: "border-purple-500 bg-purple-500/10" },
  pala: { icon: "⛏️", label: "Pala", classes: "border-orange-500 bg-orange-500/10" },
  averia: { icon: "💥", label: "Avería", classes: "border-red-500 bg-red-500/10" },
  alerta: { icon: "⚠️", label: "Alerta", classes: "border-red-500 bg-red-500/10" },
  info: { icon: "ℹ️", label: "Info", classes: "border-slate-500 bg-slate-500/10" },
};

export default function AvisosPanel({ avisos }) {
  const recientes = [...avisos].reverse().slice(0, 8);

  return (
    <div className="bg-slate-800 rounded-lg p-4 flex flex-col gap-2">
      <h2 className="text-slate-300 font-semibold text-lg">📣 Avisos</h2>
      {recientes.length === 0 ? (
        <p className="text-base text-slate-500">Sin novedades por ahora.</p>
      ) : (
        <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {recientes.map((a, i) => {
            const info = TIPO_INFO[a.tipo] || TIPO_INFO.info;
            return (
              <li
                key={i}
                className={`flex items-start gap-2 border-l-4 rounded-r-md px-2 py-1.5 text-base text-slate-200 ${info.classes}`}
              >
                <span className="text-lg leading-none mt-0.5">{info.icon}</span>
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wide text-slate-400">{info.label}</span>
                  <span>{a.texto}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
