import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/app.css";
import { App } from "./App";
import "./modules/extend";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
