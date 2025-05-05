"use client";
import { useState } from "react";
import { FiCopy, FiShare2 } from "react-icons/fi";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function CreateRoom() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const createRoom = async () => {
    try {
      setIsCreating(true);
      // Generate a unique invite ID
      const inviteId = Math.random().toString(36).substring(2, 9);

      // Create room on server
      const response = await fetch(`/api/webrtc/room/${inviteId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: "Host",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create room");
      }

      const data = await response.json();

      // Store room info in localStorage
      localStorage.setItem(
        "roomInfo",
        JSON.stringify({
          inviteId,
          roomId: data.roomId,
          isHost: true,
        })
      );

      const link = `${window.location.origin}/studio/join/${inviteId}`;
      setInviteLink(link);

      toast.success("Room created successfully!");

      // Navigate to room
      router.push(`/studio/room/${data.roomId}`);
    } catch (error) {
      console.error("Error creating room:", error);
      toast.error("Failed to create room");
    } finally {
      setIsCreating(false);
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Invite link copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy invite link");
    }
  };

  const shareInviteLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join my podcast room",
          text: "Join my podcast recording session",
          url: inviteLink,
        });
      } else {
        await copyInviteLink();
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h2 className="text-2xl font-bold mb-8">Create a New Room</h2>
      {!inviteLink ? (
        <button
          onClick={createRoom}
          disabled={isCreating}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          {isCreating ? "Creating..." : "Create Room"}
        </button>
      ) : (
        <div className="w-full max-w-md space-y-4">
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-2">Room Created!</h3>
            <p className="text-sm text-gray-600 mb-4">
              Share this link with others to join your room:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 p-2 border rounded bg-gray-50 text-sm"
              />
              <button
                onClick={copyInviteLink}
                className="p-2 hover:bg-gray-100 rounded"
                title="Copy link"
              >
                <FiCopy className="w-5 h-5" />
              </button>
              <button
                onClick={shareInviteLink}
                className="p-2 hover:bg-gray-100 rounded"
                title="Share link"
              >
                <FiShare2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
