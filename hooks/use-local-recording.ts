import { useCallback, useRef, useState } from "react";

// Records whatever canvas is passed in (the composited studio view) plus
// the local mic, and hands back a downloadable file. No server involved —
// see PRD §2/§7: cloud recording is a Phase 2 concern.
export function useLocalRecording() {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(
    (canvas: HTMLCanvasElement, micStream: MediaStream | null) => {
      const canvasStream = canvas.captureStream(30);
      if (micStream) {
        micStream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
      }

      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";

      const recorder = new MediaRecorder(canvasStream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
    },
    [],
  );

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) return resolve(new Blob());
      recorder.onstop = () => {
        setRecording(false);
        resolve(new Blob(chunksRef.current, { type: "video/webm" }));
      };
      recorder.stop();
    });
  }, []);

  const download = useCallback(
    (blob: Blob, filename = `recording-${Date.now()}.webm`) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [],
  );

  return { recording, start, stop, download };
}
