"use client";

import { useEffect, useRef } from "react";

interface AudioPreviewProps {
  isRecording: boolean;
}

export function AudioPreview({ isRecording }: AudioPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  // @ts-ignore
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    async function setupAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        source.connect(analyser);
        analyser.fftSize = 256;

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        draw();
      } catch (error) {
        console.error("Error accessing microphone:", error);
      }
    }

    setupAudio();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const draw = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const drawVisualizer = () => {
      animationFrameRef.current = requestAnimationFrame(drawVisualizer);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "rgb(17, 24, 39)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, "#4F46E5");
        gradient.addColorStop(1, "#818CF8");

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    drawVisualizer();
  };

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden w-full h-[30vh] sm:h-[40vh] md:h-[50vh] relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        width={800}
        height={400}
      />

      {isRecording && (
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
          <div className="flex items-center space-x-1 sm:space-x-2 bg-black/50 text-white px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm">
            <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-red-500 animate-pulse"></span>
            <span>REC</span>
          </div>
        </div>
      )}
    </div>
  );
}
