const FILAS = [
  { key: "tiempo_espera_promedio", label: "Espera promedio", unidad: " min", menorMejor: true },
  { key: "tiempo_ciclo_promedio", label: "Ciclo promedio", unidad: " min", menorMejor: true },
  { key: "ciclos_completados", label: "Ciclos completados", unidad: "", menorMejor: false },
];

// Solo aparece cuando ambos modos ya completaron varios ciclos. Con menos,
// la comparación engaña: los ciclos LENTOS del modo tradicional (camiones
// atrapados en cola) todavía no terminan, así que no cuentan en su promedio
// y el tradicional se ve mejor de lo que realmente es.
const MIN_CICLOS = 4;

export default function ComparacionPanel({ comparacion }) {
  const baseline = comparacion?.baseline;
  const smartmine = comparacion?.smartmine;
  if (!baseline || !smartmine) return null;
  if (baseline.ciclos_completados < MIN_CICLOS || smartmine.ciclos_completados < MIN_CICLOS) return null;

  return (
    <div className="bg-slate-800 rounded-lg p-4 flex flex-col gap-2">
      <h2 className="text-slate-300 font-semibold text-lg">📊 SmartMine vs. Tradicional</h2>
      <table className="w-full text-base">
        <thead>
          <tr className="text-slate-500 text-left">
            <th className="pb-1 font-normal"></th>
            <th className="pb-1 font-normal text-right">Tradicional</th>
            <th className="pb-1 font-normal text-right">SmartMine</th>
            <th className="pb-1 font-normal text-right">Diferencia</th>
          </tr>
        </thead>
        <tbody>
          {FILAS.map((f) => {
            const base = baseline[f.key];
            const smart = smartmine[f.key];
            const diff = base ? ((smart - base) / base) * 100 : 0;
            const mejora = f.menorMejor ? diff < 0 : diff > 0;
            // diferencias de menos de 1% son empate estadístico: gris neutro
            const empate = Math.abs(diff) < 1;
            return (
              <tr key={f.key} className="border-t border-slate-700">
                <td className="py-1 text-slate-300">{f.label}</td>
                <td className="py-1 text-right text-slate-400">
                  {base}
                  {f.unidad}
                </td>
                <td className="py-1 text-right text-slate-200">
                  {smart}
                  {f.unidad}
                </td>
                <td
                  className={`py-1 text-right font-semibold ${
                    empate ? "text-slate-400" : mejora ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {empate ? "≈ " : diff > 0 ? "+" : ""}
                  {diff.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
