import React from "react";
import ReactDOM from "react-dom/client";
import { AssistantApp } from "@/renderer/AssistantApp";
import "@/renderer/styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><AssistantApp /></React.StrictMode>,
);
