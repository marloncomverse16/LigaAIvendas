import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AppProviders } from "./providers/app-providers";

createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <App />
  </AppProviders>
);
