"use client";

import { useState } from "react";
import { StudioHeader } from "./studio-header";
import { RecordingControls } from "./recording-controls";
import { VideoPreview } from "./video-preview";
import { AudioPreview } from "./audio-preview";
import { StudioSidebar } from "./studio-sidebar";

export function StudioLayout() {
  const [isRecording, setIsRecording] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  return (
    <div className="flex h-screen">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <StudioHeader onMenuClick={() => setShowSidebar(!showSidebar)} />

        <div className="flex-1 p-6 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <VideoPreview isRecording={isRecording} />
            <AudioPreview isRecording={isRecording} />
          </div>

          <RecordingControls
            isRecording={isRecording}
            onRecordingChange={setIsRecording}
          />
        </div>
      </div>

      {/* Sidebar */}
      <StudioSidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
      />
    </div>
  );
}
