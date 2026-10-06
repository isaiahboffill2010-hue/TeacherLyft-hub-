import { IPC_CHANNELS } from "@/shared/ipc";
import type { PairRequest, TeacherLyftBridge } from "@/shared/device-types";

type Invoke = (channel: string, ...args: unknown[]) => Promise<unknown>;

export function createTeacherLyftBridge(invoke: Invoke): TeacherLyftBridge {
  return Object.freeze({
    getDeviceState: () => invoke(IPC_CHANNELS.getDeviceState) as ReturnType<TeacherLyftBridge["getDeviceState"]>,
    getDashboard: () => invoke(IPC_CHANNELS.getDashboard) as ReturnType<TeacherLyftBridge["getDashboard"]>,
    getClasses: () => invoke(IPC_CHANNELS.getClasses) as ReturnType<TeacherLyftBridge["getClasses"]>,
    getAssignments: () => invoke(IPC_CHANNELS.getAssignments) as ReturnType<TeacherLyftBridge["getAssignments"]>,
    getStudentProgress: () => invoke(IPC_CHANNELS.getStudentProgress) as ReturnType<TeacherLyftBridge["getStudentProgress"]>,
    getCurriculum: () => invoke(IPC_CHANNELS.getCurriculum) as ReturnType<TeacherLyftBridge["getCurriculum"]>,
    getDrafts: () => invoke(IPC_CHANNELS.getDrafts) as ReturnType<TeacherLyftBridge["getDrafts"]>,
    getLibrary: () => invoke(IPC_CHANNELS.getLibrary) as ReturnType<TeacherLyftBridge["getLibrary"]>,
    pair: (request: PairRequest) => invoke(IPC_CHANNELS.pair, { code: request.code }) as ReturnType<TeacherLyftBridge["pair"]>,
    retryConnection: () => invoke(IPC_CHANNELS.retryConnection) as ReturnType<TeacherLyftBridge["retryConnection"]>,
    localDisconnect: () => invoke(IPC_CHANNELS.localDisconnect) as ReturnType<TeacherLyftBridge["localDisconnect"]>,
  });
}
