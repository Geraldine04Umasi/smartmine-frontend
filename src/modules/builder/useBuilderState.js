import { useCallback, useMemo, useRef, useState } from "react";

const PREFIX = { nodo: "N", pala: "P", estacion: "E" };

function isConnected(nodes, edges) {
  if (nodes.length <= 1) return true;
  const adj = {};
  nodes.forEach((n) => (adj[n.id] = []));
  edges.forEach((e) => {
    adj[e.from]?.push(e.to);
    adj[e.to]?.push(e.from);
  });
  const visited = new Set([nodes[0].id]);
  const queue = [nodes[0].id];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of adj[cur] || []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited.size === nodes.length;
}

export function useBuilderState() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [trucks, setTrucks] = useState([]);

  // Los ids se derivan del estado previo (puro) para que funcionen bien
  // con el doble-invocado de StrictMode en desarrollo.
  // Recuerda el último nodo colocado para el modo "auto-conectar".
  const lastNodeId = useRef(null);

  const addNode = useCallback((tipo, x, y, autoConnect = false) => {
    setNodes((prev) => {
      if (tipo === "estacion" && prev.some((n) => n.tipo === "estacion")) return prev;
      const count = prev.filter((n) => n.tipo === tipo).length + 1;
      const id = `${PREFIX[tipo]}${count}`;

      if (autoConnect && lastNodeId.current) {
        const from = prev.find((n) => n.id === lastNodeId.current);
        if (from) {
          const pixelDist = Math.hypot(x - from.x, y - from.y);
          const km = Math.max(0.1, Math.round((pixelDist / 300) * 10) / 10);
          setEdges((prevEdges) => {
            const exists = prevEdges.some(
              (e) => (e.from === from.id && e.to === id) || (e.from === id && e.to === from.id)
            );
            if (exists) return prevEdges;
            return [...prevEdges, { from: from.id, to: id, distancia_km: km, cp: null }];
          });
        }
      }

      lastNodeId.current = id;
      return [...prev, { id, x, y, tipo }];
    });
  }, []);

  const moveNode = useCallback((id, x, y) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
  }, []);

  const removeNode = useCallback((id) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    setTrucks((prev) => prev.filter((t) => t.nodo_inicial !== id));
  }, []);

  const addEdge = useCallback((from, to, distanciaKm) => {
    setEdges((prev) => {
      const exists = prev.some(
        (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from)
      );
      if (exists || from === to) return prev;
      return [...prev, { from, to, distancia_km: distanciaKm, cp: null }];
    });
  }, []);

  const setEdgeCp = useCallback((from, to, cp) => {
    setEdges((prev) =>
      prev.map((e) =>
        (e.from === from && e.to === to) || (e.from === to && e.to === from) ? { ...e, cp } : e
      )
    );
  }, []);

  const updateEdgeDistance = useCallback((from, to, km) => {
    setEdges((prev) =>
      prev.map((e) =>
        (e.from === from && e.to === to) || (e.from === to && e.to === from)
          ? { ...e, distancia_km: km }
          : e
      )
    );
  }, []);

  const removeEdge = useCallback((from, to) => {
    setEdges((prev) =>
      prev.filter((e) => !((e.from === from && e.to === to) || (e.from === to && e.to === from)))
    );
  }, []);

  const addTruck = useCallback((nodoId, tipo = "CAT797") => {
    setTrucks((prev) => {
      const id = `T${String(prev.length + 1).padStart(2, "0")}`;
      return [...prev, { id, nodo_inicial: nodoId, tipo }];
    });
  }, []);

  const removeTruck = useCallback((id) => {
    setTrucks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const validation = useMemo(() => {
    const estaciones = nodes.filter((n) => n.tipo === "estacion");
    const palas = nodes.filter((n) => n.tipo === "pala");
    const errors = [];
    if (estaciones.length < 1) errors.push("Falta una estación de descarga");
    if (palas.length < 1) errors.push("Falta al menos una pala");
    if (trucks.length < 1) errors.push("Falta al menos un camión");
    if (nodes.length > 0 && !isConnected(nodes, edges)) errors.push("El grafo no está conectado");
    return { valid: errors.length === 0, errors, estaciones, palas };
  }, [nodes, edges, trucks]);

  const toPayload = useCallback(() => {
    const estacion = nodes.find((n) => n.tipo === "estacion");
    return {
      nodes: nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })),
      edges: edges.map((e) => ({
        from: e.from,
        to: e.to,
        distancia_km: e.distancia_km,
        ...(e.cp ? { cp: e.cp } : {}),
      })),
      trucks: trucks.map((t) => ({ id: t.id, tipo: t.tipo, nodo_inicial: t.nodo_inicial })),
      shovels: nodes
        .filter((n) => n.tipo === "pala")
        .map((n) => ({ id: n.id, nodo_id: n.id, capacidad_cola: 3 })),
      dump_node: estacion?.id,
    };
  }, [nodes, edges, trucks]);

  return {
    nodes,
    edges,
    trucks,
    addNode,
    moveNode,
    removeNode,
    addEdge,
    setEdgeCp,
    updateEdgeDistance,
    removeEdge,
    addTruck,
    removeTruck,
    validation,
    toPayload,
  };
}
