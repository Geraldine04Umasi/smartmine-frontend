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

// El backend solo transmite una posicion nueva por tick (~1s reales). Sin
// esto, a velocidades altas ese unico salto por segundo se ve como un
// teletransporte. Con esto, en cada frame de animacion se extrapola cuanto
// habria avanzado el camion desde el ultimo dato recibido (misma formula de
// velocidad que el backend), asi el movimiento se ve continuo entre updates.
//
// La extrapolacion se ACUMULA frame a frame usando el multiplicador vigente
// en cada frame, en vez de calcular "tiempo transcurrido x multiplicador
// actual" al momento de render. Con la formula vieja, al subir la velocidad
// (1x -> 20x) el tiempo ya transcurrido desde el ultimo dato se
// re-multiplicaba retroactivamente por 20: el camion saltaba hacia adelante
// un instante y el siguiente dato real del WS lo devolvia a su sitio (el
// "teletransporte"). Acumulando, un cambio de velocidad solo afecta a los
// frames que vienen despues, nunca a lo ya recorrido.
function useExtrapolatedKm(active, speedMultiplier, resetKey) {
  const [state, setState] = useState({ km: 0, key: resetKey });
  const speedRef = useRef(speedMultiplier);
  speedRef.current = speedMultiplier;
  const elapsedRef = useRef(0);

  // Llego un dato nuevo del WS: la posicion real ya incorpora lo extrapolado,
  // asi que lo acumulado vuelve a cero. El reset se hace DURANTE el render
  // (no en un useEffect): un efecto corre despues de pintar, y ese unico
  // frame pintado con posicion nueva + extrapolacion vieja era el
  // "teletransporte" de un instante que se veia al subir la velocidad.
  if (state.key !== resetKey) {
    elapsedRef.current = 0;
    setState({ km: 0, key: resetKey });
  }

  useEffect(() => {
    if (!active) return;
    let raf;
    let last = performance.now();
    const tick = (ts) => {
      const dt = Math.min((ts - last) / 1000, 0.25);
      last = ts;
      // tope de seguridad: si el WS se atrasa/corta, dejar de extrapolar
      if (elapsedRef.current < MAX_EXTRAPOLATION_SEC) {
        elapsedRef.current += dt;
        const kmFrame = TRUCK_SPEED_KMH * ((dt * speedRef.current) / 3600);
        setState((s) => ({ ...s, km: s.km + kmFrame }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return state.key === resetKey ? state.km : 0;
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

// Reproduce la caminata por segmentos de advance_truck (backend) para
// ubicar al camion sobre la curva bezier visual de la arista actual.
// Solo tiene sentido interpolar sobre `path` mientras el camion esta
// "hauling": en cualquier otro estado (idle/loading/dumping) su x/y ya
// reflejan la posicion real y `path` puede venir vacio o desactualizado.
function computeTruckTransform(truck, nodeById, edgeIndex, extraKm = 0) {
  const path = truck.path;
  if (truck.estado !== "hauling" || !path || path.length < 2 || !nodeById[path[0]]) {
    return { x: truck.x, y: truck.y, angle: 0 };
  }

  // Ubicar primero la arista REAL (sin extrapolar) para poder limitar la
  // extrapolación a no cruzar de arista: cruzar requiere que el backend le
  // otorgue el candado de la siguiente ruta (para que dos camiones no la
  // compartan), algo que el cliente no puede predecir. Si se dejara avanzar
  // libremente, un camión que en verdad está esperando (candado ocupado) se
  // vería "adelantarse" y luego saltar hacia atrás en cuanto llegue el
  // próximo dato real que confirme que seguía frenado en el mismo lugar.
  let realAcumulado = 0;
  let segEnd = null;
  for (let i = 0; i < path.length - 1; i++) {
    const e = edgeIndex[edgeKey(path[i], path[i + 1])];
    const dist = e ? e.distancia_km : 1.0;
    if (realAcumulado + dist >= truck.progreso_km) {
      segEnd = realAcumulado + dist;
      break;
    }
    realAcumulado += dist;
  }
  const progreso = segEnd !== null ? Math.min(truck.progreso_km + extraKm, segEnd) : truck.progreso_km;

  let acumulado = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const e = edgeIndex[edgeKey(path[i], path[i + 1])];
    const dist = e ? e.distancia_km : 1.0;
    if (acumulado + dist >= progreso) {
      const p0 = nodeById[path[i]];
      const p1 = nodeById[path[i + 1]];
      if (!p0 || !p1) break;
      const frac = dist > 0 ? (progreso - acumulado) / dist : 1;
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

  // se resetea cada vez que llega un mensaje nuevo del WS (nueva referencia
  // de `trucks`), para extrapolar el avance desde ESE instante en adelante.
  const extraKm = useExtrapolatedKm(
    trucks.some((t) => t.estado === "hauling"),
    speedMultiplier,
    trucks
  );

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
            const transform = computeTruckTransform(t, nodeById, edgeIndex, extraKm);
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
