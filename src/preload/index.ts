import { contextBridge, ipcRenderer } from "electron";
import { createTeacherLyftBridge } from "@/preload/bridge";

contextBridge.exposeInMainWorld(
  "teacherlyft",
  createTeacherLyftBridge((channel, ...args) => ipcRenderer.invoke(channel, ...args)),
);
