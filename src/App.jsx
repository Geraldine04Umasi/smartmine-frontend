import { BrowserRouter, Route, Routes } from "react-router-dom";
import ModuleSelector from "./pages/ModuleSelector";
import SimulationView from "./modules/simulation/SimulationView";
import BuilderView from "./modules/builder/BuilderView";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ModuleSelector />} />
        <Route path="/simulacion" element={<SimulationView />} />
        <Route path="/constructor" element={<BuilderView />} />
      </Routes>
    </BrowserRouter>
  );
}
