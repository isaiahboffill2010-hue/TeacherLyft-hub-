import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTeacherLyftContent, REQUEST_TIMEOUTS, verifyWithTeacherLyft } from "@/main/teacherlyft-api";
import type { DeviceCredential } from "@/shared/device-types";

const credential: DeviceCredential={deviceId:"device-1",deviceToken:`tla_${"a".repeat(32)}_${"B".repeat(43)}`};

describe("workload-specific API timeouts",()=>{
  beforeEach(()=>{vi.useFakeTimers();vi.stubEnv("TEACHERLYFT_API_URL","https://teacherlyft.test");vi.spyOn(AbortSignal,"timeout").mockImplementation((ms)=>{const controller=new AbortController();setTimeout(()=>controller.abort(new DOMException("timed out","TimeoutError")),ms);return controller.signal;});});
  afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();});

  it("allows content that takes longer than the former ten-second deadline",async()=>{
    vi.stubGlobal("fetch",vi.fn((_url:URL,init:RequestInit)=>new Promise<Response>((resolve,reject)=>{init.signal?.addEventListener("abort",()=>reject(init.signal?.reason));setTimeout(()=>resolve(Response.json({classes:[]})),11_000)})));
    const pending=fetchTeacherLyftContent(credential,"classes");
    await vi.advanceTimersByTimeAsync(10_001);
    expect(AbortSignal.timeout).toHaveBeenCalledWith(REQUEST_TIMEOUTS.content);
    await vi.advanceTimersByTimeAsync(999);
    await expect(pending).resolves.toEqual({classes:[]});
  });

  it("eventually aborts a truly hung content request",async()=>{
    vi.stubGlobal("fetch",vi.fn((_url:URL,init:RequestInit)=>new Promise<Response>((_resolve,reject)=>init.signal?.addEventListener("abort",()=>reject(init.signal?.reason)))));
    const pending=fetchTeacherLyftContent(credential,"classes");
    const assertion=expect(pending).rejects.toMatchObject({kind:"timeout"});
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUTS.content);
    await assertion;
  });

  it("keeps device verification on the short bounded deadline",async()=>{
    vi.stubGlobal("fetch",vi.fn((_url:URL,init:RequestInit)=>new Promise<Response>((_resolve,reject)=>init.signal?.addEventListener("abort",()=>reject(init.signal?.reason)))));
    const pending=verifyWithTeacherLyft(credential);
    const assertion=expect(pending).rejects.toMatchObject({kind:"timeout"});
    expect(AbortSignal.timeout).toHaveBeenCalledWith(REQUEST_TIMEOUTS.authentication);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUTS.authentication);
    await assertion;
  });

  it("issues a fresh request when retried after timeout",async()=>{
    const fetchMock=vi.fn()
      .mockImplementationOnce((_url:URL,init:RequestInit)=>new Promise<Response>((_resolve,reject)=>init.signal?.addEventListener("abort",()=>reject(init.signal?.reason))))
      .mockResolvedValueOnce(Response.json({assignments:[],countsArePartial:false}));
    vi.stubGlobal("fetch",fetchMock);
    const first=fetchTeacherLyftContent(credential,"assignments");
    const firstAssertion=expect(first).rejects.toMatchObject({kind:"timeout"});
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUTS.content); await firstAssertion;
    await expect(fetchTeacherLyftContent(credential,"assignments")).resolves.toEqual({assignments:[],countsArePartial:false});
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].signal).not.toBe(fetchMock.mock.calls[1][1].signal);
  });
});
