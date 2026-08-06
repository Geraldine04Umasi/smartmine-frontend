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
const TRUCK_SPEED_KMH = 30; // debe coincidir con TRUCK_SPEED_KMH en simulator.py
const MAX_EXTRAPOLATION_SEC = 2; // tope de seguridad si el WS se atrasa/corta

const SMOOTH_RATE = 6; // 1/s — constante de tiempo (~160 ms) del suavizado

// El backend solo transmite una posicion nueva por tick (~1s reales). Sin
// esto, a velocidades altas ese unico salto por segundo se ve como un
// teletransporte.
//
// Cada camion "hauling" mantiene aqui una posicion RENDERIZADA propia (sp,
// en km sobre su path) que se integra frame a frame: avanza persiguiendo
// exponencialmente a un objetivo (target = ultimo dato real del backend +
// extrapolacion al multiplicador vigente). Como lo que se dibuja es sp, y sp
// solo puede moverse de forma continua, NINGUN evento — llegada de un dato
// del WS con jitter, cambio de velocidad, cruce de arista — puede producir
// un salto visual: cualquier correccion del servidor solo mueve el objetivo,
// y el camion dibujado se desliza hacia el en ~160 ms.
function useSmoothedProgress(trucks, speedMultiplier) {
  const [, setFrame] = useState(0);
  const speedRef = useRef(speedMultiplier);
  speedRef.current = speedMultiplier;
  const mapRef = useRef(new Map()); // id -> { key, sp, target, lastReal, frozen }
  const staleRef = useRef(0);

  // Llego un dato del WS: re-anclar el objetivo de cada camion a su progreso
  // real. sp NO se toca (por eso no hay salto); solo persigue al nuevo target.
  useEffect(() => {
    staleRef.current = 0;
    const map = mapRef.current;
    const vivos = new Set();
    for (const t of trucks) {
      if (t.estado !== "hauling" || !t.path || t.path.length < 2) continue;
      vivos.add(t.id);
      const key = t.path.join(">");
      const e = map.get(t.id);
      if (!e || e.key !== key) {
        // path nuevo: arranca exactamente donde dice el backend (sin salto:
        // el path nuevo comienza en el nodo donde el camion ya estaba parado)
        map.set(t.id, { key, sp: t.progreso_km, target: t.progreso_km, lastReal: t.progreso_km, frozen: false });
      } else {
        // si el backend no avanzo entre mensajes, la simulacion esta en
        // pausa: congelar la extrapolacion para no "reptar" hacia adelante
        e.frozen = t.progreso_km === e.lastReal;
        e.target = e.frozen ? t.progreso_km : Math.max(t.progreso_km, Math.min(e.target, t.progreso_km + 0.2));
        e.lastReal = t.progreso_km;
      }
    }
    for (const id of [...map.keys()]) {
      if (!vivos.has(id)) map.delete(id);
    }
  }, [trucks]);

  useEffect(() => {
    let raf;
    let last = performance.now();
    const tick = (ts) => {
      const dt = Math.min((ts - last) / 1000, 0.25);
      last = ts;
      const map = mapRef.current;
      const extrapolar = staleRef.current < MAX_EXTRAPOLATION_SEC;
      staleRef.current += dt;
      const kmFrame = TRUCK_SPEED_KMH * ((dt * speedRef.current) / 3600);
      const alpha = 1 - Math.exp(-SMOOTH_RATE * dt);
      for (const e of map.values()) {
        if (extrapolar && !e.frozen) e.target += kmFrame;
        e.sp += (e.target - e.sp) * alpha;
      }
      // re-render en cada frame: ademas del avance por ruta, el canvas
      // suaviza la posicion (x, y) final de TODOS los camiones (ver
      // useSmoothedXY), y eso necesita animarse aunque nadie este "hauling"
      // (p.ej. el abanico de camiones en cola reacomodandose).
      setFrame((f) => (f + 1) % 1000000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return mapRef.current;
}

const XY_SMOOTH_RATE = 8; // 1/s — suavizado de la posicion final dibujada
const XY_SNAP_DIST = 80; // saltos mayores a esto son intencionales (reset/limpieza): no deslizar

// Segunda capa de suavizado, sobre la posicion (x, y) final de cada camion,
// en TODOS los estados. Cubre las discontinuidades que el suavizado por ruta
// no puede ver: la llegada a una pala (el estado pasa de "hauling" a
// "queued" y la posicion salta al nodo), y el reacomodo del abanico de
// camiones superpuestos (los offsets de separacion cambian de golpe cuando
// un camion entra o sale del grupo). Se usa DURANTE el render (mutando un
// ref) porque el objetivo se conoce recien al calcular la posicion de este
// frame; el re-render continuo lo garantiza useSmoothedProgress.
function makeXYSmoother(xyMapRef, dtSec) {
  const alpha = 1 - Math.exp(-XY_SMOOTH_RATE * dtSec);
  return (id, targetX, targetY) => {
    let p = xyMapRef.current.get(id);
    if (!p || Math.hypot(p.x - targetX, p.y - targetY) > XY_SNAP_DIST) {
      p = { x: targetX, y: targetY };
    } else {
      p = { x: p.x + (targetX - p.x) * alpha, y: p.y + (targetY - p.y) * alpha };
    }
    xyMapRef.current.set(id, p);
    return p;
  };
}

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

// Ubica al camion sobre la curva bezier visual de su path segun un progreso
// en km (la posicion suavizada de useSmoothedProgress). Solo tiene sentido
// interpolar sobre `path` mientras el camion esta "hauling": en cualquier
// otro estado (idle/queued/loading/dumping) su x/y ya reflejan la posicion
// real y `path` puede venir vacio o desactualizado.
function computeTruckTransform(truck, nodeById, edgeIndex, progressKm) {
  const path = truck.path;
  if (truck.estado !== "hauling" || !path || path.length < 2 || !nodeById[path[0]]) {
    return { x: truck.x, y: truck.y, angle: 0 };
  }

  let acumulado = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const e = edgeIndex[edgeKey(path[i], path[i + 1])];
    const dist = e ? e.distancia_km : 1.0;
    if (acumulado + dist >= progressKm) {
      const p0 = nodeById[path[i]];
      const p1 = nodeById[path[i + 1]];
      if (!p0 || !p1) break;
      const frac = dist > 0 ? (progressKm - acumulado) / dist : 1;
      return pointOnEdge(p0, p1, e?.cp, Math.min(Math.max(frac, 0), 1));
    }
    acumulado += dist;
  }
  const last = nodeById[path[path.length - 1]];
  return last ? { x: last.x, y: last.y, angle: 0 } : { x: truck.x, y: truck.y, angle: 0 };
}

export default function SimCanvas({ graph, trucks, shovels, faults, onToggleRoad, speedMultiplier = 1 }) {
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

  const smoothProgress = useSmoothedProgress(trucks, speedMultiplier);

  // dt real entre renders, para el suavizado (x, y) de este frame
  const xyMapRef = useRef(new Map());
  const lastRenderRef = useRef(performance.now());
  const nowTs = performance.now();
  const renderDt = Math.min((nowTs - lastRenderRef.current) / 1000, 0.25);
  lastRenderRef.current = nowTs;
  const smoothXY = makeXYSmoother(xyMapRef, renderDt);
  // limpiar camiones que ya no existen (averias/remociones)
  const idsVivos = new Set(trucks.map((t) => t.id));
  for (const id of [...xyMapRef.current.keys()]) {
    if (!idsVivos.has(id)) xyMapRef.current.delete(id);
  }

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
            const mid = pointOnEdge(a, b, e.cp, 0.5);
            return (
              <Group key={i}>
                <Path
                  data={edgePathData(a, b, e.cp)}
                  stroke={edgeFault ? "#ef4444" : isBlocked ? "#4b5563" : "#78350f"}
                  strokeWidth={4}
                  dash={isBlocked ? [6, 6] : undefined}
                  lineCap="round"
                />
                {onToggleRoad && (
                  <Group
                    x={mid.x}
                    y={mid.y}
                    onClick={() => onToggleRoad(e.from, e.to)}
                    onTap={() => onToggleRoad(e.from, e.to)}
                  >
                    <Circle radius={9} fill={isBlocked ? "#ef4444" : "#1f2937"} stroke="#0f1115" strokeWidth={1} />
                    <Text
                      text={isBlocked ? "🚧" : "🔧"}
                      x={-8}
                      y={-8}
                      width={16}
                      height={16}
                      fontSize={12}
                      align="center"
                      verticalAlign="middle"
                    />
                  </Group>
                )}
              </Group>
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
            const entry = smoothProgress.get(t.id);
            const progressKm = entry ? entry.sp : t.progreso_km;
            const transform = computeTruckTransform(t, nodeById, edgeIndex, progressKm);
            const { x, y } = smoothXY(t.id, transform.x + dx, transform.y + dy);
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
