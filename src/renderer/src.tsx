import React from "react";
import ReactDOM from "react-dom/client";
import { AssistantApp } from "@/renderer/AssistantApp";
import { ErrorBoundary } from "@/renderer/ErrorBoundary";
import "@/renderer/styles.css";

console.info("[renderer] bundle executing");
window.addEventListener("error", () => console.error("[renderer] window.onerror"));
window.addEventListener("unhandledrejection", () => console.error("[renderer] unhandledrejection"));

const rootElement = document.getElementById("root");
console.info(`[renderer] root element ${rootElement ? "found" : "missing"}`);
if (!rootElement) throw new Error("Renderer root element is missing");

console.info("[renderer] createRoot called");
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode><ErrorBoundary><AssistantApp /></ErrorBoundary></React.StrictMode>,
);
