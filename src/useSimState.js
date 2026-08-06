import { useEffect, useState } from "react";

export const API_BASE = import.meta.env.VITE_API_BASE;

function qs(session) {
  return `?session=${encodeURIComponent(session)}`;
}

function postJSON(path, body) {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => {
    if (!r.ok) throw new Error(`${path} -> ${r.status}`);
    return r.json();
  });
}

export function useSimState(session = "default") {
  const [state, setState] = useState({ trucks: [], shovels: [] });

  useEffect(() => {
    const poll = () => {
      fetch(`${API_BASE}/state${qs(session)}`)
        .then((r) => r.json())
        .then(setState)
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, [session]);

  return state;
}

export function useMetrics(session = "default") {
  const [metrics, setMetrics] = useState({
    tiempo_espera_promedio: 0,
    ciclos_completados: 0,
    tiempo_ciclo_promedio: 0,
    camiones_activos: 0,
  });

  useEffect(() => {
    const poll = () => {
      fetch(`${API_BASE}/metrics${qs(session)}`)
        .then((r) => r.json())
        .then(setMetrics)
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, [session]);

  return metrics;
}

export function useGraph(session = "default") {
  const [graph, setGraph] = useState({ nodos: [], aristas: [] });

  useEffect(() => {
    const poll = () => {
      fetch(`${API_BASE}/graph${qs(session)}`)
        .then((r) => r.json())
        .then(setGraph)
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, [session]);

  return graph;
}

// -- Control de simulacion --

export function startSim(session = "default") {
  return postJSON(`/sim/start${qs(session)}`);
}

export function stopSim(session = "default") {
  return postJSON(`/sim/stop${qs(session)}`);
}

export function resetSim(session = "default") {
  return postJSON(`/sim/reset${qs(session)}`);
}

export function setSpeed(multiplier, session = "default") {
  return postJSON(`/speed/${multiplier}${qs(session)}`);
}

// -- Mutaciones de grafo / flota --

export function toggleRoad(from, to, session = "default") {
  return postJSON(`/graph/road/toggle${qs(session)}`, { from, to });
}

export function toggleShovel(shovelId, session = "default") {
  return postJSON(`/graph/shovel/${shovelId}/toggle${qs(session)}`);
}

export function addTruck(tipo, nodoInicial, session = "default") {
  return postJSON(`/trucks/add${qs(session)}`, { tipo, nodo_inicial: nodoInicial });
}

export function removeTruck(truckId, session = "default") {
  return postJSON(`/trucks/${truckId}/remove${qs(session)}`);
}

export function createCustomSession(payload) {
  return postJSON(`/custom/create`, payload);
}
