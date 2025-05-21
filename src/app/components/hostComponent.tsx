import { useEffect, useRef } from "react";

export const HostBroadcaster = ({
  roomId,
  hostSecret,
}: {
  roomId: string;
  hostSecret: string;
}) => {
  const mediaRecorder = useRef<MediaRecorder>();
  const stream = useRef<MediaStream>();

  useEffect(() => {
    const startBroadcasting = async () => {
      // Get media devices
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Setup video element
      const video = document.createElement("video");
      video.srcObject = stream.current;
      video.play();

      // Create media recorder
      mediaRecorder.current = new MediaRecorder(stream.current, {
        mimeType: "video/webm; codecs=vp9,opus",
        videoBitsPerSecond: 2500000,
      });

      mediaRecorder.current.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const reader = new FileReader();
          reader.onload = () => {
            // Send chunk to server
            fetch(`/api/publish/${roomId}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/octet-stream",
                "X-Host-Secret": hostSecret,
                "X-Media-Type": "video",
              },
              body: new Blob([reader.result as ArrayBuffer]),
            });
          };
          reader.readAsArrayBuffer(event.data);
        }
      };

      mediaRecorder.current.start(500); // Send chunks every 500ms
    };

    startBroadcasting();

    return () => {
      mediaRecorder.current?.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, [roomId, hostSecret]);

  return null;
};

export const MediaPlayer = ({
  roomId,
  clientId,
}: {
  roomId: string;
  clientId: string;
}) => {
  const mediaSource = useRef<MediaSource>();
  const videoRef = useRef<HTMLVideoElement>();
  const sourceBuffer = useRef<SourceBuffer>();

  useEffect(() => {
    const initPlayer = async () => {
      mediaSource.current = new MediaSource();

      if (videoRef.current == undefined) return;

      videoRef.current.src = URL.createObjectURL(mediaSource.current);

      if (mediaSource.current == undefined) return;

      mediaSource.current.onsourceopen = () => {
        sourceBuffer.current = mediaSource.current.addSourceBuffer(
          'video/webm; codecs="vp9,opus"'
        );
      };

      // Start long-polling connection
      const response = await fetch(
        `/api/subscribe/${roomId}?clientId=${clientId}`
      );
      const reader = response.body?.getReader();

      const processChunk = ({ done, value }: { done: boolean; value: any }) => {
        if (done) return;

        const text = new TextDecoder().decode(value);
        const chunks = text.trim().split("\n").map(JSON.parse);

        chunks.forEach(({ type, data }) => {
          const buffer = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));

          if (!sourceBuffer.current?.updating) {
            sourceBuffer.current.appendBuffer(buffer);
          } else {
            // Queue chunks if buffer is busy
            const queue = () => {
              if (!sourceBuffer.current.updating) {
                sourceBuffer.current.appendBuffer(buffer);
              } else {
                setTimeout(queue, 50);
              }
            };
            queue();
          }
        });

        reader?.read().then(processChunk);
      };

      reader?.read().then(processChunk);
    };

    initPlayer();
  }, [roomId, clientId]);

  return <video ref={videoRef} controls autoPlay playsInline />;
};
