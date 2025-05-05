"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface JoinRoomProps {
  inviteId: string;
}

export default function JoinRoom({ inviteId }: JoinRoomProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const joinRoom = async () => {
    try {
      setIsJoining(true);

      // Join room on server
      const response = await fetch(`/api/webrtc/room/${inviteId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: displayName || "Guest",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 404) {
          toast.error("Room not found. It may have expired or been deleted.");
          return;
        }
        if (response.status === 400) {
          toast.error(data.error || "Invalid room information");
          return;
        }
        toast.error(data.error || "Failed to join room. Please try again.");
        return;
      }

      // Store room info in localStorage
      localStorage.setItem(
        "roomInfo",
        JSON.stringify({
          inviteId,
          roomId: data.roomId,
          isHost: false,
        })
      );

      // Store guest info
      localStorage.setItem(
        "guestInfo",
        JSON.stringify({
          displayName: displayName || "Guest",
        })
      );

      toast.success("Successfully joined the room!");

      // Navigate to room
      router.push(`/studio/room/${data.roomId}`);
    } catch (error) {
      console.error("Error joining room:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h2 className="text-2xl font-bold mb-8">Join Room</h2>
      <div className="w-full max-w-md space-y-4">
        <div>
          <label
            htmlFor="displayName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Your Name
          </label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={joinRoom}
          disabled={isJoining}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isJoining ? "Joining..." : "Join Room"}
        </button>
      </div>
    </div>
  );
}
