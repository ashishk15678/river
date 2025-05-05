"use client";

import { FiMic, FiVideo, FiMicOff, FiVideoOff, FiSquare } from "react-icons/fi";

interface RecordingControlsProps {
  isRecording: boolean;
  onRecordingChange: (isRecording: boolean) => void;
}

export function RecordingControls({
  isRecording,
  onRecordingChange,
}: RecordingControlsProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-center space-x-4">
        <button
          className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600"
          title="Toggle Microphone"
        >
          <FiMic className="h-6 w-6" />
        </button>

        <button
          className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600"
          title="Toggle Camera"
        >
          <FiVideo className="h-6 w-6" />
        </button>

        <button
          onClick={() => onRecordingChange(!isRecording)}
          className={`p-4 rounded-full ${
            isRecording
              ? "bg-red-600 hover:bg-red-700"
              : "bg-indigo-600 hover:bg-indigo-700"
          } text-white`}
          title={isRecording ? "Stop Recording" : "Start Recording"}
        >
          {isRecording ? (
            <FiSquare className="h-6 w-6" />
          ) : (
            <div className="h-6 w-6 rounded-full bg-white" />
          )}
        </button>
      </div>

      {isRecording && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-800">
            <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse mr-2"></span>
            Recording in progress
          </div>
        </div>
      )}
    </div>
  );
}
