import { useEffect, useRef, useState } from "react";
import { HubIcon } from "@/renderer/components/HubIcon";
import { MAX_RECORDING_MS, type AssistantAudioMimeType } from "@/shared/assistant-types";

type VoiceState = "idle" | "listening" | "transcribing" | "thinking" | "speaking" | "error";
type Props = { offline: boolean };

function recordingType(): AssistantAudioMimeType {
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm";
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) return "audio/ogg";
  return "audio/webm";
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

export function VoiceAssistant({ offline }: Props) {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);

  const releaseCapture = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  const stopSpeaking = () => { player.current?.pause(); player.current = null; if (audioUrl.current) URL.revokeObjectURL(audioUrl.current); audioUrl.current = null; setState("idle"); };

  useEffect(() => () => { releaseCapture(); player.current?.pause(); if (audioUrl.current) URL.revokeObjectURL(audioUrl.current); }, []);

  const playAnswer = async (base64: string | null, mimeType: string | null) => {
    if (!base64 || !mimeType) { setState("idle"); return; }
    try {
      const binary = atob(base64), bytes = new Uint8Array(binary.length);
      for (let i=0;i<binary.length;i+=1) bytes[i]=binary.charCodeAt(i);
      audioUrl.current = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      const audio = new Audio(audioUrl.current); player.current = audio; setState("speaking");
      audio.onended = () => stopSpeaking(); audio.onerror = () => { setMessage("The answer is shown, but audio playback failed."); stopSpeaking(); };
      await audio.play();
    } catch { setMessage("The answer is shown, but audio playback failed."); setState("idle"); }
  };

  const submit = async (blob: Blob, durationMs: number, mimeType: AssistantAudioMimeType) => {
    if (!blob.size) { setMessage("No speech was recorded. Tap to try again."); setState("error"); return; }
    try {
      setState("transcribing");
      const result = await window.teacherlyft?.askTeacherLyft({ audioBase64: await blobToBase64(blob), mimeType, durationMs });
      if (!result?.ok) { setMessage(result?.message ?? "Couldn't complete that request."); setState("error"); return; }
      setTranscript(result.transcript); setState("thinking");
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      setAnswer(result.answer);
      await playAnswer(result.audioBase64, result.audioMimeType);
    } catch { setMessage("Couldn't complete that request."); setState("error"); }
  };

  const stopRecording = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    releaseCapture();
  };

  const startRecording = async () => {
    if (offline) { setMessage("TeacherLyft Assistant requires an internet connection."); setState("error"); return; }
    setTranscript(""); setAnswer(""); setMessage(""); chunks.current=[];
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.current=media; const mimeType=recordingType(); const next=new MediaRecorder(media,{mimeType}); recorder.current=next; startedAt.current=Date.now();
      next.ondataavailable=(event)=>{if(event.data.size)chunks.current.push(event.data)};
      next.onstop=()=>{const duration=Math.max(1,Math.min(MAX_RECORDING_MS,Date.now()-startedAt.current));const blob=new Blob(chunks.current,{type:mimeType});recorder.current=null;void submit(blob,duration,mimeType)};
      next.start(); setState("listening"); stopTimer.current=setTimeout(stopRecording,MAX_RECORDING_MS);
    } catch (error) { releaseCapture(); setMessage(error instanceof DOMException&&error.name==="NotAllowedError"?"Microphone access was denied. Allow microphone access to ask TeacherLyft.":"No microphone is available."); setState("error"); }
  };

  const label=state==="listening"?"Listening…":state==="transcribing"?"Transcribing…":state==="thinking"?"Thinking…":state==="speaking"?"Stop speaking":state==="error"?"Ask again":transcript?"Tap to ask another question":"Tap to start speaking";
  const activate=state==="listening"?stopRecording:state==="speaking"?stopSpeaking:state==="transcribing"||state==="thinking"?undefined:startRecording;
  return <section className={`ask-card voice-state-${state}`}>
    <button className="microphone-button" onClick={activate} disabled={!activate} aria-label={state==="listening"?"Stop recording":label}><HubIcon name={state==="listening"||state==="speaking"?"stop":"microphone"}/></button>
    <div><p className="section-kicker">Your teaching copilot</p><h2>Ask TeacherLyft</h2><p>{state==="listening"?"Listening… tap Stop when you're finished.":state==="transcribing"?"Turning your recording into text.":state==="thinking"?"Checking your TeacherLyft data.":"Get instant help with lessons, grading, and student insights."}</p></div>
    <button className="voice-pill" onClick={activate} disabled={!activate}><span aria-hidden="true" />{label}</button>
    {(transcript||answer||message)&&<div className="voice-response" role="status">{transcript&&<p><strong>You asked:</strong> “{transcript}”</p>}{answer&&<p><strong>TeacherLyft:</strong> {answer}</p>}{message&&<p className="voice-error">{message}</p>}</div>}
  </section>;
}

