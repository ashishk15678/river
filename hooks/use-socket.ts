import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

export function useSocket() {
  const ref = useRef<Socket | null>(null);
  if (!ref.current) {
    ref.current = io({ path: "/socket.io", autoConnect: false });
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
