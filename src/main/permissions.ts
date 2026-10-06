import { isTrustedRendererUrl } from "@/main/ipc-handlers";

export function mayUseMicrophone(webContentsId: number | null, trustedWebContentsId: number | null, url: string, permission: string, mediaTypes: string[] = []): boolean {
  return webContentsId !== null && webContentsId === trustedWebContentsId && isTrustedRendererUrl(url)
    && permission === "media" && mediaTypes.length > 0 && mediaTypes.every((type) => type === "audio");
}
