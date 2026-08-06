// Curvas bezier cuadraticas (un solo control point) para aristas del grafo.

export function edgePathData(p0, p1, cp) {
  if (!cp) return `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`;
  return `M ${p0.x} ${p0.y} Q ${cp.x} ${cp.y} ${p1.x} ${p1.y}`;
}

// Punto y angulo de tangente (grados) sobre la arista para t en [0,1].
export function pointOnEdge(p0, p1, cp, t) {
  if (!cp) {
    return {
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
      angle: (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI,
    };
  }
  const mt = 1 - t;
  const x = mt * mt * p0.x + 2 * mt * t * cp.x + t * t * p1.x;
  const y = mt * mt * p0.y + 2 * mt * t * cp.y + t * t * p1.y;
  const dx = 2 * mt * (cp.x - p0.x) + 2 * t * (p1.x - cp.x);
  const dy = 2 * mt * (cp.y - p0.y) + 2 * t * (p1.y - cp.y);
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

export function midpointOfEdge(p0, p1, cp) {
  return pointOnEdge(p0, p1, cp, 0.5);
}
