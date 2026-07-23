import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress THREE.Clock deprecation warning emitted by @react-three/fiber internal loop
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('THREE.Clock')) {
    return;
  }
  originalWarn.apply(console, args);
};

createRoot(document.getElementById("root")!).render(<App />);
