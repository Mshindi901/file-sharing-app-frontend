/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";

const elem = document.getElementById("root")!;
type HotData = { root?: Root };
const root = (import.meta.hot.data as HotData).root ?? createRoot(elem);
(import.meta.hot.data as HotData).root = root;

async function startApp() {
  const configResponse = await fetch("/api-config.json");
  if (!configResponse.ok) {
    throw new Error(`App configuration request failed (${configResponse.status}).`);
  }
  const config: unknown = await configResponse.json();
  if (
    typeof config !== "object" ||
    config === null ||
    !("apiBaseUrl" in config) ||
    typeof config.apiBaseUrl !== "string"
  ) {
    throw new Error("App configuration did not include a valid API base URL.");
  }

  window.__FILE_SHARE_API_BASE_URL__ = config.apiBaseUrl;
  const { App } = await import("./App");
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void startApp().catch((error: unknown) => {
  root.render(
    <main role="alert" style={{ maxWidth: 560, margin: "15vh auto", padding: 24 }}>
      <h1>Couldn’t start Keepsake</h1>
      <p>{error instanceof Error ? error.message : "The app configuration could not be loaded."}</p>
    </main>,
  );
});
