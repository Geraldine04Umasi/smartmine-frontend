export const ESTADO_COLOR = {
  idle: "#6b7280",
  hauling: "#3b82f6",
  loading: "#f59e0b",
  dumping: "#22c55e",
};

function uniqueEdges(aristas) {
  const seen = new Set();
  const edges = [];
  for (const e of aristas) {
    const key = [e.from, e.to].sort().join("-");
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(e);
  }
  return edges;
}

export default function MineMap({ graph, trucks, shovels }) {
  if (!graph.nodos || graph.nodos.length === 0) return null;
  const nodeById = Object.fromEntries(graph.nodos.map((n) => [n.id, n]));
  const shovelByNode = Object.fromEntries(shovels.map((s) => [s.nodo, s]));

  const xs = graph.nodos.map((n) => n.x);
  const ys = graph.nodos.map((n) => n.y);
  const minX = Math.min(...xs) - 40;
  const maxX = Math.max(...xs) + 70;
  const minY = Math.min(...ys) - 35;
  const maxY = Math.max(...ys) + 40;
  const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;

  return (
    <svg viewBox={viewBox} className="w-full h-full bg-slate-900 rounded-lg">
      {uniqueEdges(graph.aristas).map((e, i) => {
        const a = nodeById[e.from];
        const b = nodeById[e.to];
        if (!a || !b) return null;
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#374151"
            strokeWidth={3}
          />
        );
      })}

      {graph.nodos.map((n) => {
        const shovel = shovelByNode[n.id];
        if (shovel) return null;
        return <circle key={n.id} cx={n.x} cy={n.y} r={4} fill="#4b5563" />;
      })}

      {shovels.map((s) => {
        const n = nodeById[s.nodo];
        if (!n) return null;
        return (
          <g key={s.id}>
            <rect x={n.x - 10} y={n.y - 10} width={20} height={20} fill="#a855f7" rx={3} />
            <text x={n.x} y={n.y - 16} textAnchor="middle" fontSize="12" fill="#e5e7eb">
              {s.id} ({s.cola_actual.length}/{s.capacidad_cola})
            </text>
          </g>
        );
      })}

      {trucks.map((t) => (
        <g key={t.id}>
          <circle
            cx={t.x}
            cy={t.y}
            r={9}
            fill={ESTADO_COLOR[t.estado] || "#9ca3af"}
            stroke="#0f1115"
            strokeWidth={2}
            style={{ transition: "cx 1s linear, cy 1s linear, fill 0.3s linear" }}
          />
          <text
            x={t.x}
            y={t.y - 14}
            textAnchor="middle"
            fontSize="11"
            fill="#f3f4f6"
            style={{ transition: "x 1s linear, y 1s linear" }}
          >
            {t.id}
          </text>
        </g>
      ))}
    </svg>
  );
}
