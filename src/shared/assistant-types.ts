export const MAX_RECORDING_MS = 30_000;
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const SUPPORTED_AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/wav"] as const;
export type AssistantAudioMimeType = (typeof SUPPORTED_AUDIO_TYPES)[number];
export type AssistantRequest = { audioBase64: string; mimeType: AssistantAudioMimeType; durationMs: number };
export type AssistantResult =
  | { ok: true; transcript: string; answer: string; audioMimeType: "audio/wav" | null; audioBase64: string | null }
  | { ok: false; error: "unpaired" | "unauthorized" | "offline" | "invalid_audio" | "unavailable"; message: string };

export function isAssistantRequest(value: unknown): value is AssistantRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).every((key) => ["audioBase64", "mimeType", "durationMs"].includes(key))
    && typeof item.audioBase64 === "string" && item.audioBase64.length > 0
    && item.audioBase64.length <= Math.ceil(MAX_AUDIO_BYTES / 3) * 4
    && typeof item.mimeType === "string" && (SUPPORTED_AUDIO_TYPES as readonly string[]).includes(item.mimeType)
    && typeof item.durationMs === "number" && Number.isFinite(item.durationMs)
    && item.durationMs > 0 && item.durationMs <= MAX_RECORDING_MS + 1_000;
}
