import { useEffect, useRef, useCallback, useState } from "react";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketProps {
  roomId?: string;
  role: "host" | "participant";
  onRoomState?: (state: any) => void;
  onParticipantJoined?: (participant: any) => void;
  onParticipantLeft?: (participant: any) => void;
  onHostLeft?: () => void;
  onError?: (error: string) => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";

// Keep track of global connection state
let globalWs: WebSocket | null = null;
let connectionPromise: Promise<void> | null = null;

export function useWebSocket({
  roomId,
  role,
  onRoomState,
  onParticipantJoined,
  onParticipantLeft,
  onHostLeft,
  onError,
}: UseWebSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const hasJoinedRoom = useRef(false);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const joinRoom = useCallback(() => {
    if (
      roomId &&
      !hasJoinedRoom.current &&
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      sendMessage({
        type: "join-room",
        roomId,
        role,
      });
      hasJoinedRoom.current = true;
    }
  }, [roomId, role, sendMessage]);

  useEffect(() => {
    const connectWebSocket = async () => {
      // If we already have a connection promise, wait for it
      if (connectionPromise) {
        await connectionPromise;
        return;
      }

      // If we have a global connection and it's open, use it
      if (globalWs?.readyState === WebSocket.OPEN) {
        wsRef.current = globalWs;
        setIsConnected(true);
        joinRoom();
        return;
      }

      // Create new connection promise
      connectionPromise = new Promise((resolve, reject) => {
        try {
          // Close existing connection if any
          if (globalWs) {
            globalWs.close();
            globalWs = null;
          }

          const ws = new WebSocket(WS_URL);
          globalWs = ws;
          wsRef.current = ws;

          ws.onopen = () => {
            console.log("WebSocket connected");
            setIsConnected(true);
            setReconnectAttempt(0);
            hasJoinedRoom.current = false;
            joinRoom();
            resolve();
          };

          ws.onclose = () => {
            console.log("WebSocket disconnected");
            setIsConnected(false);
            setSocketId(null);
            hasJoinedRoom.current = false;

            // Only attempt reconnect if this is the active connection
            if (ws === globalWs) {
              const timeout = Math.min(
                1000 * Math.pow(2, reconnectAttempt),
                30000
              );
              reconnectTimeoutRef.current = setTimeout(() => {
                setReconnectAttempt((prev) => prev + 1);
                connectionPromise = null;
                connectWebSocket();
              }, timeout);
            }
          };

          ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            onError?.("Failed to connect to WebSocket server");
            reject(error);
          };

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              console.log("Received message:", data);

              switch (data.type) {
                case "your-id":
                  setSocketId(data.id);
                  break;
                case "room-state":
                  onRoomState?.(data);
                  break;
                case "participant-joined":
                  onParticipantJoined?.(data);
                  break;
                case "participant-left":
                  onParticipantLeft?.(data);
                  break;
                case "host-left":
                  onHostLeft?.();
                  break;
                case "error":
                  onError?.(data.message);
                  break;
              }
            } catch (error) {
              console.error("Error parsing WebSocket message:", error);
            }
          };
        } catch (error) {
          console.error("Error creating WebSocket connection:", error);
          onError?.("Failed to create WebSocket connection");
          reject(error);
        }
      });

      try {
        await connectionPromise;
      } finally {
        connectionPromise = null;
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // Only close the connection if this is the last component using it
      if (wsRef.current === globalWs) {
        hasJoinedRoom.current = false;
        if (socketId) {
          sendMessage({ type: "leave-room" });
        }
      }
    };
  }, [
    roomId,
    role,
    sendMessage,
    socketId,
    onRoomState,
    onParticipantJoined,
    onParticipantLeft,
    onHostLeft,
    onError,
    reconnectAttempt,
    joinRoom,
  ]);

  return {
    isConnected,
    socketId,
    sendMessage,
  };
}
