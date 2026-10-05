import { IPC_CHANNELS } from "@/shared/ipc";
import type { PairRequest, TeacherLyftBridge } from "@/shared/device-types";

type Invoke = (channel: string, ...args: unknown[]) => Promise<unknown>;

export function createTeacherLyftBridge(invoke: Invoke): TeacherLyftBridge {
  return Object.freeze({
    getDeviceState: () => invoke(IPC_CHANNELS.getDeviceState) as ReturnType<TeacherLyftBridge["getDeviceState"]>,
    getDashboard: () => invoke(IPC_CHANNELS.getDashboard) as ReturnType<TeacherLyftBridge["getDashboard"]>,
    pair: (request: PairRequest) => invoke(IPC_CHANNELS.pair, { code: request.code }) as ReturnType<TeacherLyftBridge["pair"]>,
    retryConnection: () => invoke(IPC_CHANNELS.retryConnection) as ReturnType<TeacherLyftBridge["retryConnection"]>,
    localDisconnect: () => invoke(IPC_CHANNELS.localDisconnect) as ReturnType<TeacherLyftBridge["localDisconnect"]>,
  });
}
