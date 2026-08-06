export default function ShovelQueueTable({ shovels }) {
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
              <td className="py-2 text-white flex items-center gap-1.5">
                {s.id}
                {s.enabled === false && <span title="Pala deshabilitada">⚠️</span>}
              </td>
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
