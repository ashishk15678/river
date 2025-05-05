"use client";

import { useEffect, useRef, useState } from "react";
import { FiCamera, FiCameraOff } from "react-icons/fi";

interface VideoPreviewProps {
  isRecording: boolean;
}

export function VideoPreview({ isRecording }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      const userAgent =
        navigator.userAgent || navigator.vendor || (window as any).opera;
      const mobileRegex =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      setIsMobile(mobileRegex.test(userAgent.toLowerCase()));
    };
    checkMobile();
  }, []);

  useEffect(() => {
    async function setupCamera() {
      try {
        // Try to get the best available camera
        const constraints = {
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Error accessing camera:", err);

        // Handle specific error cases
        if (err.name === "NotAllowedError") {
          setError(
            "Camera access was denied. Please allow camera access to continue."
          );
        } else if (err.name === "NotFoundError") {
          setError("No camera found on your device.");
        } else if (
          err.name === "NotReadableError" ||
          err.name === "TrackStartError"
        ) {
          setError("Your camera is already in use by another application.");
        } else if (isMobile) {
          // For mobile devices, show fallback options
          setShowFallback(true);
        } else {
          setError("Failed to access camera. Please try again.");
        }
      }
    }

    setupCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isMobile]);

  const handleFallbackClick = () => {
    // Open camera app or alternative browser
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isIOS) {
      // For iOS, try to open camera app
      window.location.href = "camera://";
    } else if (isAndroid) {
      // For Android, try to open camera app
      window.location.href =
        "intent://camera/#Intent;scheme=android-app;package=com.android.camera;end";
    } else {
      // For other devices, suggest using a different browser
      setError(
        "Please try using Chrome, Firefox, or Safari for better compatibility."
      );
    }
  };

  if (error) {
    return (
      <div className="bg-black rounded-lg overflow-hidden w-full h-[50vh] sm:h-[60vh] md:h-[70vh] relative flex items-center justify-center">
        <div className="text-center p-4">
          <FiCameraOff className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white mb-4">{error}</p>
          {showFallback && (
            <button
              onClick={handleFallbackClick}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Open Camera App
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black rounded-lg overflow-hidden w-full h-[50vh] sm:h-[60vh] md:h-[70vh] relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover transform scale-x-[-1]"
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
