import { ESTADO_COLOR, ESTADO_LABEL } from "../lib/theme";

export default function EstadoLegend() {
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
