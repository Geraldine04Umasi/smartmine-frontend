import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Circle, Path, Image as KonvaImage, Text, Group } from "react-konva";
import { useImage } from "../../lib/useImage";
import { edgePathData, pointOnEdge } from "../../lib/bezier";
import { truckColor } from "../../lib/theme";
import truckSvg from "../../assets/truck.svg";
import shovelSvg from "../../assets/shovel.svg";
import stationSvg from "../../assets/station.svg";

const OVERLAP_BUCKET_PX = 10;
const OVERLAP_OFFSET_RADIUS = 11;

// Angulo derivado solo del id del camion (estable): evita que un camion
// "salte" de posicion cuando otro camion entra o sale de su mismo grupo de
// superposicion, ya que antes el angulo dependia del tamano del grupo.
function hashAngle(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ((hash % 360) * Math.PI) / 180;
}

function computeOverlapOffsets(trucks) {
  const groups = {};
  trucks.forEach((t) => {
    const key = `${Math.round(t.x / OVERLAP_BUCKET_PX)},${Math.round(t.y / OVERLAP_BUCKET_PX)}`;
    (groups[key] ||= []).push(t.id);
  });
  const offsets = {};
  Object.values(groups).forEach((ids) => {
    if (ids.length === 1) {
      offsets[ids[0]] = { dx: 0, dy: 0 };
      return;
    }
    ids.forEach((id) => {
      const angle = hashAngle(id);
      offsets[id] = {
        dx: Math.cos(angle) * OVERLAP_OFFSET_RADIUS,
        dy: Math.sin(angle) * OVERLAP_OFFSET_RADIUS,
      };
    });
  });
  return offsets;
}

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

function edgeKey(a, b) {
  return `${a}->${b}`;
}

function buildEdgeIndex(aristas) {
  const map = {};
  (aristas || []).forEach((e) => {
    map[edgeKey(e.from, e.to)] = e;
  });
  return map;
}

// Reproduce la caminata por segmentos de advance_truck (backend) para
// ubicar al camion sobre la curva bezier visual de la arista actual.
// Solo tiene sentido interpolar sobre `path` mientras el camion esta
// "hauling": en cualquier otro estado (idle/loading/dumping) su x/y ya
// reflejan la posicion real y `path` puede venir vacio o desactualizado.
function computeTruckTransform(truck, nodeById, edgeIndex) {
  const path = truck.path;
  if (truck.estado !== "hauling" || !path || path.length < 2 || !nodeById[path[0]]) {
    return { x: truck.x, y: truck.y, angle: 0 };
  }
  let acumulado = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const e = edgeIndex[edgeKey(path[i], path[i + 1])];
    const dist = e ? e.distancia_km : 1.0;
    if (acumulado + dist >= truck.progreso_km) {
      const p0 = nodeById[path[i]];
      const p1 = nodeById[path[i + 1]];
      if (!p0 || !p1) break;
      const frac = dist > 0 ? (truck.progreso_km - acumulado) / dist : 1;
      return pointOnEdge(p0, p1, e?.cp, Math.min(Math.max(frac, 0), 1));
    }
    acumulado += dist;
  }
  const last = nodeById[path[path.length - 1]];
  return last ? { x: last.x, y: last.y, angle: 0 } : { x: truck.x, y: truck.y, angle: 0 };
}

export default function SimCanvas({ graph, trucks, shovels, faults }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 600, height: 450 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const truckImg = useImage(truckSvg);
  const shovelImg = useImage(shovelSvg);
  const stationImg = useImage(stationSvg);

  if (!graph.nodos || graph.nodos.length === 0) {
    return <div ref={containerRef} className="w-full h-full bg-slate-900 rounded-lg" />;
  }

  const nodeById = Object.fromEntries(graph.nodos.map((n) => [n.id, n]));
  const shovelByNode = Object.fromEntries(shovels.map((s) => [s.nodo, s]));
  const edgeIndex = buildEdgeIndex(graph.aristas);

  const xs = graph.nodos.map((n) => n.x);
  const ys = graph.nodos.map((n) => n.y);
  const minX = Math.min(...xs) - 40;
  const maxX = Math.max(...xs) + 70;
  const minY = Math.min(...ys) - 35;
  const maxY = Math.max(...ys) + 40;
  const graphW = maxX - minX;
  const graphH = maxY - minY;
  const scale = Math.max(0.01, Math.min(size.width / graphW, size.height / graphH));
  const offsetX = (size.width - graphW * scale) / 2 - minX * scale;
  const offsetY = (size.height - graphH * scale) / 2 - minY * scale;

  const overlapOffsets = computeOverlapOffsets(trucks);
  const dumpNode = graph.entrada && nodeById[graph.entrada] ? graph.entrada : null;

  const faultTrucks = faults?.trucks || new Set();
  const faultShovels = faults?.shovels || new Set();
  const faultEdges = faults?.edges || new Set();

  return (
    <div ref={containerRef} className="w-full h-full">
      <Stage width={size.width} height={size.height}>
        <Layer>
          <Rect x={0} y={0} width={size.width} height={size.height} fill="#161b22" cornerRadius={12} />
        </Layer>

        <Layer scaleX={scale} scaleY={scale} x={offsetX} y={offsetY}>
          {uniqueEdges(graph.aristas || []).map((e, i) => {
            const a = nodeById[e.from];
            const b = nodeById[e.to];
            if (!a || !b) return null;
            const isBlocked = e.bloqueado;
            const edgeFault = faultEdges.has([e.from, e.to].sort().join("-"));
            return (
              <Path
                key={i}
                data={edgePathData(a, b, e.cp)}
                stroke={edgeFault ? "#ef4444" : isBlocked ? "#4b5563" : "#78350f"}
                strokeWidth={4}
                dash={isBlocked ? [6, 6] : undefined}
                lineCap="round"
              />
            );
          })}

          {graph.nodos.map((n) => {
            if (shovelByNode[n.id] || n.id === dumpNode) return null;
            return <Circle key={n.id} x={n.x} y={n.y} radius={4} fill="#4b5563" />;
          })}

          {shovels.map((s) => {
            const n = nodeById[s.nodo];
            if (!n) return null;
            const isFault = faultShovels.has(s.id) || s.enabled === false;
            return (
              <Group key={s.id} x={n.x} y={n.y}>
                {shovelImg && (
                  <KonvaImage
                    image={shovelImg}
                    width={28}
                    height={28}
                    offsetX={14}
                    offsetY={14}
                    opacity={isFault ? 0.4 : 1}
                  />
                )}
                <Text
                  text={`${s.id} (${s.cola_actual.length}/${s.capacidad_cola})`}
                  x={-30}
                  y={-30}
                  width={60}
                  align="center"
                  fontSize={11}
                  fill="#e5e7eb"
                />
                {isFault && <Text text="⚠️" x={10} y={-28} fontSize={16} />}
              </Group>
            );
          })}

          {dumpNode && (
            <Group x={nodeById[dumpNode].x} y={nodeById[dumpNode].y}>
              {stationImg && (
                <KonvaImage image={stationImg} width={30} height={30} offsetX={15} offsetY={15} />
              )}
              <Text text="Descarga" x={-30} y={18} width={60} align="center" fontSize={10} fill="#a7f3d0" />
            </Group>
          )}

          {trucks.map((t) => {
            const { dx, dy } = overlapOffsets[t.id] || { dx: 0, dy: 0 };
            const transform = computeTruckTransform(t, nodeById, edgeIndex);
            const x = transform.x + dx;
            const y = transform.y + dy;
            const angle = transform.angle || 0;
            const isFault = faultTrucks.has(t.id);
            return (
              <Group key={t.id} x={x} y={y} rotation={angle}>
                <Circle radius={12} fill={truckColor(t)} opacity={0.55} />
                {truckImg && (
                  <KonvaImage image={truckImg} width={20} height={20} offsetX={10} offsetY={10} />
                )}
                <Text text={t.id} x={-16} y={-26} width={32} align="center" fontSize={10} fill="#f3f4f6" rotation={-angle} />
                {isFault && <Text text="⚠️" x={6} y={-24} fontSize={13} rotation={-angle} />}
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
