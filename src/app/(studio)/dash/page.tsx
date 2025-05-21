"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Video,
  Bell,
  Plus,
  Headphones,
  Share2,
  Download,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Clock,
  Maximize2,
  Play,
  Home,
  BarChart2,
  Settings,
  Users,
  MessageSquare,
  HelpCircle,
  Menu,
  ChevronLeft,
  LogOut,
  Folder,
  Calendar,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  // initiatliasation
  const peer = useRef<RTCPeerConnection>(null);
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const participants = useRef<Map<string, { muted: boolean }>>(new Map());

  useEffect(() => {
    const initializeHost = async () => {
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Handle incoming connections
      peer.onicecandidate = ({ candidate }) => {
        if (candidate) {
          // Store candidates to share with new participants
        }
      };

      peer.ontrack = (event) => {
        // Handle incoming media tracks
        const video = document.createElement("video");
        video.srcObject = event.streams[0];
        document.body.appendChild(video);
      };

      // Create data channel for room control
      const controlChannel = peer.createDataChannel("control");
      controlChannel.onmessage = handleControlMessage;

      // Register room with server
      await fetch("/api/create-room", {
        method: "POST",
        body: JSON.stringify({ hostPeerId: peer.localDescription?.sdp }),
      });

      return () => peer.close();
    };

    initializeHost();
  }, []);

  const broadcastState = () => {
    const state = Array.from(participants.current.entries()).map(
      ([id, data]) => ({
        userId: id,
        muted: data.muted,
      })
    );

    dataChannels.current.forEach((channel) => {
      channel.send(JSON.stringify({ type: "stateUpdate", state }));
    });
  };

  const handleControlMessage = useCallback((event: MessageEvent) => {
    const { type, userId, data } = JSON.parse(event.data);

    switch (type) {
      case "mute":
        participants.current.set(userId, {
          ...participants.current.get(userId),
          muted: true,
        });
        broadcastState();
        break;

      case "kick":
        dataChannels.current.get(userId)?.close();
        participants.current.delete(userId);
        break;
    }
  }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let animationFrameId: number;

    const initializeMedia = async () => {
      try {
        console.log("Requesting user media...");
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Your browser does not support media devices");
        }

        const stream = await navigator.mediaDevices
          .getUserMedia({
            audio: true,
            video: true,
          })
          .catch((err) => {
            if (err.name === "NotAllowedError") {
              throw new Error(
                "Camera and microphone access was denied. Please allow access to use this feature."
              );
            } else if (err.name === "NotFoundError") {
              throw new Error(
                "No camera or microphone found. Please connect a device and try again."
              );
            } else if (err.name === "NotReadableError") {
              throw new Error(
                "Your camera or microphone is already in use by another application."
              );
            } else {
              throw new Error(`Failed to access media devices: ${err.message}`);
            }
          });

        console.log("Got media stream:", stream);

        if (!stream.getVideoTracks().length) {
          throw new Error("No video track found in the stream");
        }

        setMediaStream(stream);
        setError(null); // Clear any previous errors

        if (videoRef.current) {
          console.log("Setting video stream to element");
          videoRef.current.srcObject = stream;
          // Ensure video starts playing
          videoRef.current.play().catch((err) => {
            console.error("Error playing video:", err);
            setError(
              "Failed to start video playback. Please try refreshing the page."
            );
          });
        } else {
          throw new Error(
            "Video element not found. Please try refreshing the page."
          );
        }

        // Set up audio level monitoring
        try {
          audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(stream);
          const analyzer = audioContext.createAnalyser();
          analyzer.fftSize = 256;
          source.connect(analyzer);

          const dataArray = new Uint8Array(analyzer.frequencyBinCount);
          const updateVolume = () => {
            if (!audioContext) return;
            analyzer.getByteFrequencyData(dataArray);
            const average =
              dataArray.reduce((a, b) => a + b) / dataArray.length;
            setVolumeLevel(Math.min(100, (average / 128) * 100));
            animationFrameId = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        } catch (err) {
          console.error("Error setting up audio monitoring:", err);
          setError(
            "Failed to set up audio monitoring. Video should still work."
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";
        console.error("Error accessing media devices:", error);
        setError(errorMessage);
      }
    };

    initializeMedia();

    return () => {
      // Cleanup media stream and audio context
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
      if (audioContext) {
        audioContext.close();
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="dashboard-bg min-h-screen">
      {/* Sidebar */}
      <div
        className={`dashboard-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}
      >
        <div className="p-4 flex items-center justify-between border-b border-gray-200">
          <div className="flex items-center">
            {!sidebarCollapsed && (
              <h1 className="text-xl font-bold text-gray-900">MusicWave</h1>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="comic-button bg-white p-1"
          >
            {sidebarCollapsed ? <Menu size={28} /> : <ChevronLeft size={18} />}
          </Button>
        </div>

        <div className="py-4">
          <div className="mb-6">
            <p
              className={`px-4 text-xs font-semibold text-gray-500 mb-2 ${
                sidebarCollapsed ? "hidden" : ""
              }`}
            >
              MAIN
            </p>
            <nav>
              <a href="#" className="sidebar-link active">
                <Home size={20} className="icon" />
                <span className="text">Dashboard</span>
              </a>
              <a href="#" className="sidebar-link">
                <Mic size={20} className="icon" />
                <span className="text">Studio</span>
              </a>
              <a href="#" className="sidebar-link">
                <Folder size={20} className="icon" />
                <span className="text">Library</span>
              </a>
              <a href="#" className="sidebar-link">
                <Calendar size={20} className="icon" />
                <span className="text">Schedule</span>
              </a>
            </nav>
          </div>

          <div className="mb-6">
            <p
              className={`px-4 text-xs font-semibold text-gray-500 mb-2 ${
                sidebarCollapsed ? "hidden" : ""
              }`}
            >
              ANALYTICS
            </p>
            <nav>
              <a href="#" className="sidebar-link">
                <BarChart2 size={20} className="icon" />
                <span className="text">Statistics</span>
              </a>
              <a href="#" className="sidebar-link">
                <Users size={20} className="icon" />
                <span className="text">Audience</span>
              </a>
              <a href="#" className="sidebar-link">
                <MessageSquare size={20} className="icon" />
                <span className="text">Feedback</span>
              </a>
            </nav>
          </div>

          <div>
            <p
              className={`px-4 text-xs font-semibold text-gray-500 mb-2 ${
                sidebarCollapsed ? "hidden" : ""
              }`}
            >
              SETTINGS
            </p>
            <nav>
              <a href="#" className="sidebar-link">
                <Settings size={20} className="icon" />
                <span className="text">Settings</span>
              </a>
              <a href="#" className="sidebar-link">
                <HelpCircle size={20} className="icon" />
                <span className="text">Help</span>
              </a>
            </nav>
          </div>
        </div>

        <div className={`sidebar-footer ${sidebarCollapsed ? "p-2" : ""}`}>
          {!sidebarCollapsed && (
            <div className="flex items-center mb-4">
              <Avatar className="h-10 w-10 mr-3">
                <AvatarImage
                  src="/placeholder.svg?height=40&width=40"
                  alt="User"
                />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">Alex Johnson</p>
                <p className="text-xs text-gray-500">alex@example.com</p>
              </div>
            </div>
          )}

          {sidebarCollapsed && (
            <Avatar className="h-10 w-10 mx-auto mb-4">
              <AvatarImage
                src="/placeholder.svg?height=40&width=40"
                alt="User"
              />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          )}

          <Button
            variant="outline"
            size="sm"
            className={`comic-button bg-white ${
              sidebarCollapsed ? "w-full justify-center" : "w-full"
            }`}
          >
            <LogOut size={16} className={sidebarCollapsed ? "" : "mr-2"} />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={`dashboard-content ${
          sidebarCollapsed ? "sidebar-collapsed" : ""
        }`}
      >
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="px-4 py-3 flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900 mr-4">
                Recording Studio
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="icon"
                className="text-gray-500 comic-button bg-white"
              >
                <Bell size={18} />
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src="/placeholder.svg?height=32&width=32"
                  alt="User"
                />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <main className="px-4 py-6">
          <div className="flex justify-between items-center mb-6">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : -20 }}
              transition={{ duration: 0.5 }}
            >
              <Button
                variant="outline"
                className="comic-button bg-white"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const response = await fetch("/api/webrtc/room", {
                      method: "POST",
                      body: JSON.stringify({
                        displayName: "Alex Johnson",
                        role: "host",
                      }),
                    });
                    const data = await response.json();
                    router.push(`/room/${data.roomId}`);
                  } catch (error) {
                    console.error(error);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {loading ? (
                  <Loader2 size={16} className="mr-2" />
                ) : (
                  <Plus size={16} className="mr-2" />
                )}
                New Project
              </Button>
            </motion.div>
          </div>

          {error && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md">
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                  <div className="ml-auto pl-3">
                    <button
                      onClick={() => setError(null)}
                      className="inline-flex text-red-500 hover:text-red-700 focus:outline-none"
                    >
                      <span className="sr-only">Dismiss</span>
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <AnimatePresence>
                {isLoaded && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Card className="comic-border bg-white">
                      <CardHeader className="border-b border-gray-100 p-4">
                        <CardTitle className="text-gray-900 text-lg">
                          Recording Session
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="aspect-video bg-gray-100 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 grid grid-cols-2 gap-2 p-4">
                            <div className="bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                              <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="bg-gray-200 rounded-lg flex items-center justify-center">
                              <Avatar className="h-20 w-20">
                                <AvatarImage
                                  src="/placeholder.svg?height=80&width=80"
                                  alt="Guest"
                                />
                                <AvatarFallback className="text-2xl">
                                  G
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          </div>

                          <div className="absolute bottom-4 right-4 flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-white/90 backdrop-blur-sm"
                            >
                              <Maximize2 size={14} />
                            </Button>
                          </div>

                          {isRecording && (
                            <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full flex items-center">
                              <span className="h-2 w-2 bg-white rounded-full mr-2 animate-pulse"></span>
                              Recording
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3 justify-center">
                          <Button
                            onClick={toggleRecording}
                            className={`comic-button ${
                              isRecording
                                ? "bg-red-500 hover:bg-red-600 text-white"
                                : "bg-white"
                            } px-4 py-1 text-sm`}
                          >
                            {isRecording ? (
                              <>
                                <Pause className="mr-1 h-4 w-4" /> Stop
                              </>
                            ) : (
                              <>
                                <Mic className="mr-1 h-4 w-4" /> Record
                              </>
                            )}
                          </Button>

                          <Button className="comic-button bg-white px-4 py-1 text-sm">
                            <Video className="mr-1 h-4 w-4" /> Video
                          </Button>

                          <Button className="comic-button bg-white px-4 py-1 text-sm">
                            <Headphones className="mr-1 h-4 w-4" /> Audio
                          </Button>

                          <Button className="comic-button bg-white px-4 py-1 text-sm">
                            <Share2 className="mr-1 h-4 w-4" /> Invite
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div>
              <AnimatePresence>
                {isLoaded && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    <Card className="comic-border bg-white">
                      <CardHeader className="border-b border-gray-100 p-4">
                        <CardTitle className="text-gray-900 text-lg">
                          Session Info
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Session Name
                            </label>
                            <Input
                              placeholder="Enter session name"
                              className="border-gray-300 focus:border-gray-500 focus:ring-gray-500 text-sm"
                              defaultValue="Interview with Alex Chen"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Participants
                            </label>
                            <div className="flex items-center space-x-2 mb-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage
                                  src="/placeholder.svg?height=24&width=24"
                                  alt="Host"
                                />
                                <AvatarFallback>H</AvatarFallback>
                              </Avatar>
                              <span className="text-sm">You (Host)</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage
                                  src="/placeholder.svg?height=24&width=24"
                                  alt="Guest"
                                />
                                <AvatarFallback>G</AvatarFallback>
                              </Avatar>
                              <span className="text-sm">Alex Chen (Guest)</span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Recording Time
                            </label>
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4 text-gray-500" />
                              <span className="text-base font-mono">
                                00:12:34
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Audio Levels
                            </label>
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs w-12">You</span>
                                <div className="h-2 bg-gray-200 rounded-full flex-1">
                                  <div
                                    className="h-2 bg-green-500 rounded-full w-3/4 animate-pulse"
                                    style={{
                                      width: `${volumeLevel}%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 mb-6">
            <AnimatePresence>
              {isLoaded && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <Card className="comic-border bg-white">
                    <CardHeader className="border-b border-gray-100 p-4">
                      <CardTitle className="text-gray-900 text-lg">
                        Audio Controls
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center">
                        <div className="w-full max-w-3xl">
                          <div className="h-16 bg-gray-100 rounded-lg mb-3 relative">
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-full px-6">
                                <div className="h-8 bg-gray-200 rounded flex items-center justify-center">
                                  <div className="w-full flex space-x-0.5">
                                    {Array.from({ length: 50 }).map((_, i) => (
                                      <div
                                        key={i}
                                        className="bg-purple-500 w-1"
                                        style={{
                                          height: `${Math.max(
                                            3,
                                            Math.sin(i * 0.2) * 15 +
                                              Math.random() * 8
                                          )}px`,
                                          opacity: isRecording ? 1 : 0.5,
                                        }}
                                      ></div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between items-center mb-3 text-xs text-gray-500">
                            <div>00:12:34</div>
                            <div>-00:47:26</div>
                          </div>

                          <div className="flex justify-center items-center space-x-3 mb-4">
                            <Button
                              variant="outline"
                              size="icon"
                              className="comic-button bg-white h-8 w-8"
                            >
                              <SkipBack size={16} />
                            </Button>

                            <Button
                              variant="outline"
                              size="icon"
                              className="comic-button bg-white h-10 w-10"
                              onClick={toggleRecording}
                            >
                              {isRecording ? (
                                <Pause size={20} />
                              ) : (
                                <Mic size={20} />
                              )}
                            </Button>

                            <Button
                              variant="outline"
                              size="icon"
                              className="comic-button bg-white h-8 w-8"
                            >
                              <SkipForward size={16} />
                            </Button>
                          </div>

                          <div className="flex items-center space-x-3">
                            <Volume2 size={16} className="text-gray-500" />
                            <Slider
                              defaultValue={[75]}
                              max={100}
                              step={1}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence>
              {isLoaded && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <Card className="comic-border bg-white">
                    <CardHeader className="border-b border-gray-100 p-4">
                      <CardTitle className="text-gray-900 text-lg">
                        Recent Recordings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-gray-100">
                        {[1, 2, 3].map((item) => (
                          <div
                            key={item}
                            className="flex items-center justify-between p-3 hover:bg-gray-50"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <Headphones
                                  size={16}
                                  className="text-gray-500"
                                />
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900 text-sm">
                                  Interview Session #{item}
                                </h4>
                                <p className="text-xs text-gray-500">
                                  May {10 + item}, 2025 • 45:12
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                              >
                                <Play size={14} className="mr-1" /> Play
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                              >
                                <Download size={14} className="mr-1" /> Download
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isLoaded && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <Card className="comic-border bg-white">
                    <CardHeader className="border-b border-gray-100 p-4">
                      <CardTitle className="text-gray-900 text-lg">
                        Quick Tips
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                      <Tabs defaultValue="audio">
                        <TabsList className="mb-3">
                          <TabsTrigger value="audio" className="text-xs">
                            Audio Tips
                          </TabsTrigger>
                          <TabsTrigger value="video" className="text-xs">
                            Video Tips
                          </TabsTrigger>
                          <TabsTrigger value="interview" className="text-xs">
                            Interview Tips
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="audio" className="space-y-3">
                          <div className="p-2 bg-purple-50 rounded-lg border border-purple-100">
                            <h4 className="font-medium text-purple-800 mb-1 text-sm">
                              Use a Good Microphone
                            </h4>
                            <p className="text-xs text-purple-700">
                              A quality microphone makes a huge difference in
                              your recording quality.
                            </p>
                          </div>

                          <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                            <h4 className="font-medium text-blue-800 mb-1 text-sm">
                              Find a Quiet Space
                            </h4>
                            <p className="text-xs text-blue-700">
                              Minimize background noise by recording in a quiet
                              environment.
                            </p>
                          </div>
                        </TabsContent>

                        <TabsContent value="video" className="space-y-3">
                          <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                            <h4 className="font-medium text-amber-800 mb-1 text-sm">
                              Good Lighting is Key
                            </h4>
                            <p className="text-xs text-amber-700">
                              Position yourself facing a light source for the
                              best video quality.
                            </p>
                          </div>

                          <div className="p-2 bg-red-50 rounded-lg border border-red-100">
                            <h4 className="font-medium text-red-800 mb-1 text-sm">
                              Camera at Eye Level
                            </h4>
                            <p className="text-xs text-red-700">
                              Position your camera at eye level for the most
                              flattering angle.
                            </p>
                          </div>
                        </TabsContent>

                        <TabsContent value="interview" className="space-y-3">
                          <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                            <h4 className="font-medium text-indigo-800 mb-1 text-sm">
                              Prepare Questions
                            </h4>
                            <p className="text-xs text-indigo-700">
                              Have a list of questions ready but be flexible
                              with the conversation flow.
                            </p>
                          </div>

                          <div className="p-2 bg-pink-50 rounded-lg border border-pink-100">
                            <h4 className="font-medium text-pink-800 mb-1 text-sm">
                              Active Listening
                            </h4>
                            <p className="text-xs text-pink-700">
                              Focus on what your guest is saying rather than
                              thinking about your next question.
                            </p>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
