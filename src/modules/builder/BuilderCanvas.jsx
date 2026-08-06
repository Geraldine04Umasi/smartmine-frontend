import { useState } from "react";
import { Stage, Layer, Rect, Circle, Path, Text, Group } from "react-konva";
import { edgePathData, midpointOfEdge } from "../../lib/bezier";

const NODE_COLOR = { nodo: "#4b5563", pala: "#a855f7", estacion: "#22c55e" };
const NODE_RADIUS = { nodo: 6, pala: 14, estacion: 16 };
const CANVAS_W = 700;
const CANVAS_H = 480;
const PX_PER_KM = 300; // misma conversión que useBuilderState usa para auto-conectar
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.1;

function defaultDistanceKm(a, b) {
  const pixelDist = Math.hypot(b.x - a.x, b.y - a.y);
  return Math.max(0.1, Math.round((pixelDist / PX_PER_KM) * 10) / 10);
}

function clampScale(s) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, +s.toFixed(2)));
}

export default function BuilderCanvas({ builder, tool, autoConnect }) {
  const {
    nodes,
    edges,
    trucks,
    addNode,
    moveNode,
    addEdge,
    setEdgeCp,
    updateEdgeDistance,
    addTruck,
    removeNode,
    removeEdge,
    removeTruck,
  } = builder;
  const [pendingFrom, setPendingFrom] = useState(null);
  const [distancePrompt, setDistancePrompt] = useState(null); // {from,to,x,y,editing}
  const [distanceValue, setDistanceValue] = useState("1.0");
  const [scale, setScale] = useState(1);

  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const handleStageClick = (e) => {
    if (e.target.name() !== "background") return;
    if (tool === "nodo" || tool === "pala" || tool === "estacion") {
      const pos = e.target.getStage().getPointerPosition();
      // getPointerPosition() es espacio-stage (sin escalar); convertir al
      // espacio local de la capa de contenido, que sí está escalada.
      addNode(tool, pos.x / scale, pos.y / scale, autoConnect);
    } else if (tool === "arista") {
      setPendingFrom(null);
    }
  };

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const delta = e.evt.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
    setScale((s) => clampScale(s + delta));
  };

  const handleNodeClick = (node) => {
    if (tool === "borrar") {
      removeNode(node.id);
      return;
    }
    if (tool === "camion") {
      addTruck(node.id, "CAT797");
      return;
    }
    if (tool === "arista") {
      if (!pendingFrom) {
        setPendingFrom(node.id);
        return;
      }
      if (pendingFrom === node.id) {
        setPendingFrom(null);
        return;
      }
      const a = nodeById[pendingFrom];
      setDistancePrompt({
        from: pendingFrom,
        to: node.id,
        x: (a.x + node.x) / 2,
        y: (a.y + node.y) / 2,
        editing: false,
      });
      setDistanceValue(String(defaultDistanceKm(a, node)));
      setPendingFrom(null);
    }
  };

  const handleEdgeLabelClick = (edge, mid) => {
    if (tool === "borrar") {
      removeEdge(edge.from, edge.to);
      return;
    }
    setDistancePrompt({ from: edge.from, to: edge.to, x: mid.x, y: mid.y, editing: true });
    setDistanceValue(String(edge.distancia_km));
  };

  const confirmDistance = () => {
    const km = parseFloat(distanceValue);
    if (distancePrompt && km > 0) {
      if (distancePrompt.editing) {
        updateEdgeDistance(distancePrompt.from, distancePrompt.to, km);
      } else {
        addEdge(distancePrompt.from, distancePrompt.to, km);
      }
    }
    setDistancePrompt(null);
    setDistanceValue("1.0");
  };

  // La barra de escala siempre mide lo mismo en pantalla (px); a más zoom,
  // esos mismos píxeles representan menos km.
  const scaleBarPx = 100;
  const scaleBarKm = scaleBarPx / scale / PX_PER_KM;

  return (
    <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
      <Stage width={CANVAS_W} height={CANVAS_H} onClick={handleStageClick} onWheel={handleWheel}>
        <Layer>
          <Rect name="background" x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#161b22" cornerRadius={12} />
        </Layer>

        <Layer scaleX={scale} scaleY={scale}>
          {edges.map((e, i) => {
            const a = nodeById[e.from];
            const b = nodeById[e.to];
            if (!a || !b) return null;
            const mid = midpointOfEdge(a, b, e.cp);
            return (
              <Group key={i}>
                <Path
                  data={edgePathData(a, b, e.cp)}
                  stroke="#78350f"
                  strokeWidth={4 / scale}
                  lineCap="round"
                  hitStrokeWidth={16 / scale}
                  onClick={() => tool === "borrar" && removeEdge(e.from, e.to)}
                />
                <Text
                  text={`${e.distancia_km}km`}
                  x={mid.x - 20}
                  y={mid.y - 18}
                  width={40}
                  align="center"
                  fontSize={10}
                  fill="#fcd34d"
                  onClick={() => handleEdgeLabelClick(e, mid)}
                />
                <Circle
                  x={mid.x}
                  y={mid.y}
                  radius={5 / scale}
                  fill="#fbbf24"
                  draggable
                  onDragMove={(evt) => setEdgeCp(e.from, e.to, { x: evt.target.x(), y: evt.target.y() })}
                />
              </Group>
            );
          })}

          {nodes.map((n) => (
            <Group
              key={n.id}
              x={n.x}
              y={n.y}
              draggable={tool !== "arista"}
              onDragMove={(evt) => moveNode(n.id, evt.target.x(), evt.target.y())}
              onClick={() => handleNodeClick(n)}
            >
              <Circle
                radius={NODE_RADIUS[n.tipo]}
                fill={NODE_COLOR[n.tipo]}
                stroke={pendingFrom === n.id ? "#f8fafc" : "#0f1115"}
                strokeWidth={pendingFrom === n.id ? 3 : 1.5}
              />
              <Text
                text={n.id}
                x={-18}
                y={NODE_RADIUS[n.tipo] + 4}
                width={36}
                align="center"
                fontSize={10}
                fill="#e5e7eb"
                listening={false}
              />
            </Group>
          ))}

          {trucks.map((t) => {
            const n = nodeById[t.nodo_inicial];
            if (!n) return null;
            return (
              <Group key={t.id} x={n.x} y={n.y - 24} onClick={() => tool === "borrar" && removeTruck(t.id)}>
                <Circle radius={9} fill="#3b82f6" stroke="#0f1115" strokeWidth={2} />
                <Text text={t.id} x={-18} y={-24} width={36} align="center" fontSize={10} fill="#f3f4f6" listening={false} />
              </Group>
            );
          })}
        </Layer>
      </Stage>

      {distancePrompt && (
        <div
          className="absolute bg-slate-800 border border-slate-600 rounded-lg p-3 flex items-center gap-2 shadow-xl z-10"
          style={{
            left: Math.min(distancePrompt.x * scale + 10, CANVAS_W - 170),
            top: Math.min(distancePrompt.y * scale + 10, CANVAS_H - 50),
          }}
        >
          <label className="text-xs text-slate-300">Distancia (km)</label>
          <input
            autoFocus
            type="number"
            step="0.1"
            min="0.1"
            value={distanceValue}
            onChange={(e) => setDistanceValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmDistance()}
            className="w-16 bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-sm text-white"
          />
          <button onClick={confirmDistance} className="text-xs bg-purple-600 hover:bg-purple-500 px-2 py-1 rounded text-white">
            OK
          </button>
        </div>
      )}

      {tool === "arista" && pendingFrom && (
        <div className="absolute top-2 left-2 bg-slate-800/90 text-xs text-slate-300 px-2 py-1 rounded">
          Selecciona el nodo destino para {pendingFrom}...
        </div>
      )}

      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button
          onClick={() => setScale((s) => clampScale(s + SCALE_STEP))}
          className="w-7 h-7 flex items-center justify-center bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded text-sm font-bold"
          title="Acercar"
        >
          +
        </button>
        <button
          onClick={() => setScale((s) => clampScale(s - SCALE_STEP))}
          className="w-7 h-7 flex items-center justify-center bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded text-sm font-bold"
          title="Alejar"
        >
          −
        </button>
        <button
          onClick={() => setScale(1)}
          className="w-7 h-7 flex items-center justify-center bg-slate-800/90 hover:bg-slate-700 text-slate-400 rounded text-[10px]"
          title="Restablecer zoom"
        >
          1x
        </button>
      </div>

      <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-slate-900/80 px-2 py-1 rounded">
        <div className="h-0.5 bg-slate-300" style={{ width: scaleBarPx }} />
        <span className="text-[10px] text-slate-300 whitespace-nowrap">{scaleBarKm.toFixed(2)} km</span>
      </div>
    </div>
  );
}
