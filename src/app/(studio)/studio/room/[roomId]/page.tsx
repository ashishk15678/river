"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PodcastRoom from "@/app/(studio)/studio/components/podcast-room";
import { toast } from "sonner";
import { use } from "react";

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default function RoomPage({ params }: PageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const resolvedParams = use(params);

  useEffect(() => {
    const validateRoom = async () => {
      try {
        // Check if we have room info in localStorage
        const roomInfo = localStorage.getItem("roomInfo");
        if (!roomInfo) {
          throw new Error("No room information found");
        }

        const { roomId, inviteId } = JSON.parse(roomInfo);

        // Validate that the room ID matches
        if (roomId !== resolvedParams.roomId) {
          throw new Error("Invalid room access");
        }

        // Validate room on server
        const response = await fetch(`/api/webrtc/room/${inviteId}`);
        if (!response.ok) {
          throw new Error("Invalid room");
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Room validation error:", error);
        setError("Invalid or expired room");
        toast.error("Failed to join room");
        // Redirect to studio page after 3 seconds
        setTimeout(() => {
          router.push("/studio");
        }, 3000);
      }
    };

    validateRoom();
  }, [router, resolvedParams.roomId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <p className="text-gray-300">Redirecting to studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900">
      <PodcastRoom roomId={resolvedParams.roomId} />
    </div>
  );
}
