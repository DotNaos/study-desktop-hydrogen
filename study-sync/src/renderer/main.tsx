import "./main.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App";

const container = document.getElementById("root");

if (container) {
  const root = (container as any)._reactRoot ?? createRoot(container);
  (container as any)._reactRoot = root;

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
