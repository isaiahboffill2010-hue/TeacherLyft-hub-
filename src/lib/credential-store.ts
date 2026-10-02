import "server-only";

import { constants } from "node:fs";
import { access, chmod, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DeviceCredential } from "@/lib/device-types";

const TOKEN_PATTERN = /^tla_[0-9a-f]{32}_[A-Za-z0-9_-]{43}$/;

export function getCredentialPath(): string {
  if (process.env.TEACHERLYFT_CREDENTIAL_PATH) {
    return path.resolve(process.env.TEACHERLYFT_CREDENTIAL_PATH);
  }
  return process.platform === "linux"
    ? "/var/lib/teacherlyft-assistant/device.json"
    : path.join(process.cwd(), ".teacherlyft-state", "device.json");
}

export function isDeviceCredential(value: unknown): value is DeviceCredential {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DeviceCredential>;
  return typeof candidate.deviceId === "string"
    && candidate.deviceId.length > 0
    && candidate.deviceId.length <= 128
    && typeof candidate.deviceToken === "string"
    && TOKEN_PATTERN.test(candidate.deviceToken);
}

async function rejectSymlink(target: string): Promise<void> {
  try {
    const info = await lstat(target);
    if (info.isSymbolicLink()) throw new Error("Credential path must not be a symbolic link");
    if (!info.isFile()) throw new Error("Credential path is not a regular file");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
}

export async function loadDeviceCredential(): Promise<DeviceCredential | null> {
  const target = getCredentialPath();
  try {
    await access(target, constants.R_OK);
    await rejectSymlink(target);
    const parsed: unknown = JSON.parse(await readFile(/* turbopackIgnore: true */ target, "utf8"));
    return isDeviceCredential(parsed) ? parsed : null;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

export async function saveDeviceCredential(credential: DeviceCredential): Promise<void> {
  if (!isDeviceCredential(credential)) throw new Error("Invalid device credential");
  const target = getCredentialPath();
  const directory = path.dirname(target);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") await chmod(directory, 0o700);
  await rejectSymlink(target);

  const temporary = path.join(directory, `.device-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(credential)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    if (process.platform !== "win32") await chmod(temporary, 0o600);
    await rename(temporary, target);
    if (process.platform !== "win32") await chmod(target, 0o600);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

export async function deleteDeviceCredential(): Promise<void> {
  await rm(getCredentialPath(), { force: true });
}
