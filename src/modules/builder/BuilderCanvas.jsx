import { useState } from "react";
import { Stage, Layer, Rect, Circle, Path, Text, Group } from "react-konva";
import { edgePathData, midpointOfEdge } from "../../lib/bezier";

const NODE_COLOR = { nodo: "#4b5563", pala: "#a855f7", estacion: "#22c55e" };
const NODE_RADIUS = { nodo: 6, pala: 14, estacion: 16 };
const CANVAS_W = 700;
const CANVAS_H = 480;

export default function BuilderCanvas({ builder, tool }) {
  const { nodes, edges, trucks, addNode, moveNode, addEdge, setEdgeCp, addTruck, removeNode, removeEdge, removeTruck } =
    builder;
  const [pendingFrom, setPendingFrom] = useState(null);
  const [distancePrompt, setDistancePrompt] = useState(null);
  const [distanceValue, setDistanceValue] = useState("1.0");

  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const handleStageClick = (e) => {
    if (e.target.name() !== "background") return;
    if (tool === "nodo" || tool === "pala" || tool === "estacion") {
      const pos = e.target.getStage().getPointerPosition();
      addNode(tool, pos.x, pos.y);
    } else if (tool === "arista") {
      setPendingFrom(null);
    }
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
      setDistancePrompt({ from: pendingFrom, to: node.id, x: (a.x + node.x) / 2, y: (a.y + node.y) / 2 });
      setPendingFrom(null);
    }
  };

  const confirmDistance = () => {
    const km = parseFloat(distanceValue);
    if (distancePrompt && km > 0) {
      addEdge(distancePrompt.from, distancePrompt.to, km);
    }
    setDistancePrompt(null);
    setDistanceValue("1.0");
  };

  return (
    <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
      <Stage width={CANVAS_W} height={CANVAS_H} onClick={handleStageClick}>
        <Layer>
          <Rect name="background" x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#161b22" cornerRadius={12} />

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
                  strokeWidth={4}
                  lineCap="round"
                  hitStrokeWidth={16}
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
                  listening={false}
                />
                <Circle
                  x={mid.x}
                  y={mid.y}
                  radius={5}
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
          style={{ left: Math.min(distancePrompt.x + 10, CANVAS_W - 170), top: Math.min(distancePrompt.y + 10, CANVAS_H - 50) }}
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
    </div>
  );
}
