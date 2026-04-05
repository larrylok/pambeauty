import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
// Remove Emergent badge if injected (safe, no app dependency)
setInterval(() => {
  const badge = document.querySelector("#emergent-badge");
  if (badge) badge.remove();
}, 1000);