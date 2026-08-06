// "hauling" se separa visualmente en dos: yendo vacío hacia la pala (ida)
// vs. yendo cargado hacia la estación de descarga (vuelta).
export const ESTADO_COLOR = {
  idle: "#6b7280",
  hauling_empty: "#38bdf8",
  hauling_loaded: "#f97316",
  queued: "#ef4444",
  loading: "#f59e0b",
  dumping: "#22c55e",
};

export const ESTADO_LABEL = {
  idle: "Libre",
  hauling_empty: "En ruta (vacío)",
  hauling_loaded: "En ruta (cargado)",
  queued: "En cola",
  loading: "Cargando",
  dumping: "Descargando",
};

// Determina la clave de color/label para un camión según su estado + fase.
export function truckStateKey(truck) {
  if (truck.estado === "hauling") {
    return truck._fase === "vuelta" ? "hauling_loaded" : "hauling_empty";
  }
  return truck.estado;
}

export function truckColor(truck) {
  return ESTADO_COLOR[truckStateKey(truck)] || "#9ca3af";
}
