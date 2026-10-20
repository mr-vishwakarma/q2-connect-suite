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
// In production builds, suppress verbose diagnostic logging so internal error
// details (stack traces, payloads, backend responses) are not exposed in the
// browser console. User-facing messages are surfaced via toasts instead.
if (import.meta.env.PROD) {
  const noop = () => {};
  console.error = noop;
  console.warn = noop;
  console.debug = noop;
  console.info = noop;
  console.log = noop;
}

// Handle dynamic import / chunk load failures when a new version is deployed
window.addEventListener('vite:preloadError', () => {
  const lastReload = sessionStorage.getItem('vite_preload_reload_time');
  const now = Date.now();
  // Auto-reload at most once every 10 seconds to avoid reload loops
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem('vite_preload_reload_time', now.toString());
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
