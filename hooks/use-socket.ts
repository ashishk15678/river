import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

export function useSocket(userId?: string | null) {
  const ref = useRef<Socket | null>(null);
  if (!ref.current) {
    ref.current = io({
      path: "/socket.io",
      autoConnect: false,
      // Pass userId so the server can derive isHost from DB ownership.
      // Null/undefined means anonymous guest — server treats isHost=false.
      auth: { userId: userId ?? null },
    });
  }

  useEffect(() => {
    const socket = ref.current!;
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, []);

  return ref.current;
}
