import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

const renderFatal = (message: string) => {
  const root = document.getElementById("root");
  if (!root) {
    return;
  }

  root.innerHTML = `
    <div style="min-height:100vh;padding:24px;background:#f4efe4;color:#1b1308;font-family:Trebuchet MS,Segoe UI,sans-serif;">
      <div style="max-width:640px;margin:0 auto;background:#fffaf1;border:2px solid #d8c7ac;border-radius:24px;padding:20px;">
        <div style="font-size:14px;color:#6f604f;margin-bottom:8px;">Ошибка запуска приложения</div>
        <h1 style="margin:0 0 12px;font-size:28px;">Не удалось открыть Market Bazaar</h1>
        <pre style="white-space:pre-wrap;word-break:break-word;background:#efe4cd;padding:14px;border-radius:18px;">${message}</pre>
        <p style="color:#6f604f;">Сделайте скриншот этого экрана и пришлите его, если ошибка повторится.</p>
      </div>
    </div>
  `;
};

window.addEventListener("error", (event) => {
  renderFatal(event.error?.stack || event.message || "Неизвестная ошибка");
});

window.addEventListener("unhandledrejection", (event) => {
  const reason =
    event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason);
  renderFatal(reason);
});

registerSW({ immediate: true });

try {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  renderFatal(error instanceof Error ? error.stack || error.message : String(error));
}
