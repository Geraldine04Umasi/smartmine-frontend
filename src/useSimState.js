import { useEffect, useState } from "react";

export const API_BASE = "http://localhost:8000";

export function useSimState() {
  const [state, setState] = useState({ trucks: [], shovels: [] });

  useEffect(() => {
    const poll = () => {
      fetch(`${API_BASE}/state`)
        .then((r) => r.json())
        .then(setState)
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, []);

  return state;
}

export function useMetrics() {
  const [metrics, setMetrics] = useState({
    tiempo_espera_promedio: 0,
    ciclos_completados: 0,
    tiempo_ciclo_promedio: 0,
    camiones_activos: 0,
  });

  useEffect(() => {
    const poll = () => {
      fetch(`${API_BASE}/metrics`)
        .then((r) => r.json())
        .then(setMetrics)
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, []);

  return metrics;
}
