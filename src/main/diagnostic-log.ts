import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const LOG_FILENAME = "teacherlyft-hub.log";
const PREVIOUS_LOG_FILENAME = "teacherlyft-hub.previous.log";
const MAX_LOG_BYTES = 2 * 1024 * 1024;
const SENSITIVE_KEY = /token|authorization|password|credential|pairing.?code|device.?id|teacher.?name|account/i;

type LogLevel = "info" | "warn" | "error";
type LogMetadata = Record<string, unknown>;

let logPath: string | null = null;

function redactText(value: string): string {
  return value
    .replace(/tla_[0-9a-f]{32}_[A-Za-z0-9_-]{43}/gi, "[redacted-token]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b\d{6}\b/g, "[redacted-code]")
    .slice(0, 500);
}

function safeValue(key: string, value: unknown, depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (depth >= 3) return "[omitted]";
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeValue("item", item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      safeValue(childKey, childValue, depth + 1),
    ]));
  }
  return String(value);
}

function safeMetadata(metadata: LogMetadata): LogMetadata {
  return Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, safeValue(key, value)]));
}

export function formatDiagnosticEntry(
  level: LogLevel,
  scope: string,
  event: string,
  metadata: LogMetadata = {},
  timestamp = new Date(),
): string {
  return JSON.stringify({ timestamp: timestamp.toISOString(), level, scope, event, ...safeMetadata(metadata) });
}

export function configureDiagnosticLog(directory: string): string {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  logPath = join(directory, LOG_FILENAME);
  if (existsSync(logPath) && statSync(logPath).size >= MAX_LOG_BYTES) {
    const previous = join(directory, PREVIOUS_LOG_FILENAME);
    rmSync(previous, { force: true });
    renameSync(logPath, previous);
  }
  diagnosticInfo("logging", "configured", { path: logPath });
  return logPath;
}

function write(level: LogLevel, scope: string, event: string, metadata: LogMetadata): void {
  const entry = formatDiagnosticEntry(level, scope, event, metadata);
  const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  consoleMethod(`[teacherlyft/${scope}] ${event}`, safeMetadata(metadata));
  if (!logPath) return;
  try {
    appendFileSync(logPath, `${entry}\n`, { encoding: "utf8", mode: 0o600 });
  } catch (error) {
    console.error("[teacherlyft/logging] write_failed", error instanceof Error ? error.message : "unknown error");
  }
}

export function diagnosticInfo(scope: string, event: string, metadata: LogMetadata = {}): void {
  write("info", scope, event, metadata);
}

export function diagnosticWarn(scope: string, event: string, metadata: LogMetadata = {}): void {
  write("warn", scope, event, metadata);
}

export function diagnosticError(scope: string, event: string, metadata: LogMetadata = {}): void {
  write("error", scope, event, metadata);
}
