import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createTeacherLyftBridge } from "@/preload/bridge";
import { IPC_CHANNELS, isAssistantRequest } from "@/shared/ipc";
import { MAX_RECORDING_MS } from "@/shared/assistant-types";
import { mayUseMicrophone } from "@/main/permissions";

const source=()=>readFileSync(new URL("../src/renderer/components/VoiceAssistant.tsx",import.meta.url),"utf8");

describe("tap-to-speak assistant",()=>{
 it("uses one fixed typed IPC method",async()=>{const invoke=vi.fn().mockResolvedValue({ok:true});const bridge=createTeacherLyftBridge(invoke);await bridge.askTeacherLyft({audioBase64:"YQ==",mimeType:"audio/webm",durationMs:1000});expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.askTeacherLyft,{audioBase64:"YQ==",mimeType:"audio/webm",durationMs:1000});expect(JSON.stringify(invoke.mock.calls)).not.toMatch(/deviceToken|GEMINI_API_KEY|Authorization/)});
 it("validates bounded audio",()=>{expect(isAssistantRequest({audioBase64:"YQ==",mimeType:"audio/webm",durationMs:1000})).toBe(true);expect(isAssistantRequest({audioBase64:"",mimeType:"audio/webm",durationMs:1000})).toBe(false);expect(isAssistantRequest({audioBase64:"YQ==",mimeType:"video/webm",durationMs:1000})).toBe(false);expect(isAssistantRequest({audioBase64:"YQ==",mimeType:"audio/webm",durationMs:MAX_RECORDING_MS+1001})).toBe(false)});
 it("allows only audio capture from the trusted renderer",()=>{expect(mayUseMicrophone(7,7,"file:///app/index.html","media",["audio"])).toBe(true);expect(mayUseMicrophone(7,7,"file:///app/index.html","media",["video"])).toBe(false);expect(mayUseMicrophone(8,7,"file:///app/index.html","media",["audio"])).toBe(false);expect(mayUseMicrophone(7,7,"https://evil.test","media",["audio"])).toBe(false);expect(mayUseMicrophone(7,7,"file:///app/index.html","geolocation",[])).toBe(false)});
 it("implements the requested states, auto-stop and track release",()=>{const text=source();for(const value of ["idle","listening","transcribing","thinking","speaking","error","Listening…","Transcribing…","Thinking…","Stop speaking","Tap to ask another question"])expect(text).toContain(value);expect(text).toContain("setTimeout(stopRecording,MAX_RECORDING_MS)");expect(text).toContain("getTracks().forEach((track) => track.stop())")});
 it("shows transcript and answer while preserving text on TTS failure",()=>{const text=source();expect(text).toContain("You asked:");expect(text).toContain("TeacherLyft:");expect(text).toContain("The answer is shown, but audio playback failed.")});
 it("blocks offline recording and adds no Assistant navigation item",()=>{expect(source()).toContain("TeacherLyft Assistant requires an internet connection.");const nav=readFileSync(new URL("../src/renderer/components/BottomNav.tsx",import.meta.url),"utf8");expect(nav).not.toMatch(/label:\s*["']Assistant/)});
});
