"use client";

import { FiX, FiSettings, FiMic, FiVideo, FiMonitor } from "react-icons/fi";

interface StudioSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StudioSidebar({ isOpen, onClose }: StudioSidebarProps) {
  return (
    <div
      className={`fixed inset-y-0 right-0 w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="h-full flex flex-col">
        <div className="px-4 py-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {/* Video Settings */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">Video</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FiVideo className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-700">Camera</span>
                  </div>
                  <select className="text-sm border-gray-300 rounded-md">
                    <option>Default Camera</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FiMonitor className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-700">Resolution</span>
                  </div>
                  <select className="text-sm border-gray-300 rounded-md">
                    <option>1080p</option>
                    <option>720p</option>
                    <option>480p</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Audio Settings */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">Audio</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FiMic className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-700">Microphone</span>
                  </div>
                  <select className="text-sm border-gray-300 rounded-md">
                    <option>Default Microphone</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FiSettings className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-700">Sample Rate</span>
                  </div>
                  <select className="text-sm border-gray-300 rounded-md">
                    <option>48 kHz</option>
                    <option>44.1 kHz</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
