export default function AhorroBadge({ minutos }) {
  return (
    <div className="flex items-center gap-2 bg-emerald-900/40 border border-emerald-600 rounded-full px-4 py-1.5">
      <span className="text-emerald-400">⏱️</span>
      <span className="text-sm text-emerald-300">Ahorro acumulado por IA:</span>
      <span className="text-lg font-bold text-emerald-400 tabular-nums">{minutos} min</span>
    </div>
  );
}
