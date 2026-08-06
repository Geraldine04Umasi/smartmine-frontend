export default function MetricCard({ label, value, suffix }) {
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
