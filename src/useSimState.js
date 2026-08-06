import { useEffect, useState } from "react";

export const API_BASE = import.meta.env.VITE_API_BASE;
const WS_BASE = API_BASE.replace(/^http/, "ws");

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

const EMPTY_LIVE_DATA = {
  trucks: [],
  shovels: [],
  metricas: {
    tiempo_espera_promedio: 0,
    ciclos_completados: 0,
    tiempo_ciclo_promedio: 0,
    camiones_activos: 0,
    tiempo_ahorrado_min: 0,
    modo: "smartmine",
    utilizacion_pct: 0,
    comparacion: { smartmine: null, baseline: null },
    speed_multiplier: 1,
  },
  graph: { nodos: [], aristas: [] },
  avisos: [],
};

// Reemplaza el polling REST (3 peticiones/seg por vista) por un único
// WebSocket por sesión que recibe trucks/shovels/metricas/graph en cada tick.
// `enabled` permite no abrir el socket hasta que la sesión realmente exista
// (p.ej. la sesión "custom" antes de crear el diseño en el constructor).
export function useLiveSession(session = "default", enabled = true) {
  const [data, setData] = useState(EMPTY_LIVE_DATA);

  useEffect(() => {
    if (!enabled) {
      setData(EMPTY_LIVE_DATA);
      return;
    }

    let socket;
    let retryTimer;
    let closedByUs = false;

    const connect = () => {
      socket = new WebSocket(`${WS_BASE}/ws${qs(session)}`);
      socket.onmessage = (evt) => {
        try {
          setData(JSON.parse(evt.data));
        } catch {
          // ignorar mensajes malformados
        }
      };
      socket.onclose = () => {
        if (!closedByUs) retryTimer = setTimeout(connect, 1000);
      };
      socket.onerror = () => socket.close();
    };

    connect();
    return () => {
      closedByUs = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, [session, enabled]);

  return data;
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
