import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, Point, ServerToClientEvents, Stroke } from "../../../shared/protocol";
import { boardReducer, emptyBoard, randomId } from "./reducer";

type WhiteboardSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "";

/** Connects to a room and exposes the board plus the actions the UI needs. */
export function useWhiteboard(roomId: string, name: string) {
  const [board, dispatch] = useReducer(boardReducer, emptyBoard);
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const socketRef = useRef<WhiteboardSocket | null>(null);
  const pending = useRef<{ strokeId: string; points: Point[] } | null>(null);

  useEffect(() => {
    const socket: WhiteboardSocket = io(SERVER_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setMyId(socket.id ?? null);
      socket.emit("room:join", { roomId, name });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("board:state", (state) => dispatch({ type: "state", state }));
    socket.on("stroke:start", (stroke) => dispatch({ type: "strokeStart", stroke }));
    socket.on("stroke:points", ({ strokeId, points }) => dispatch({ type: "strokePoints", strokeId, points }));
    socket.on("stroke:remove", ({ strokeId }) => dispatch({ type: "strokeRemove", strokeId }));
    socket.on("board:cleared", ({ by }) => dispatch({ type: "cleared", by }));
    socket.on("user:joined", (user) => dispatch({ type: "userJoined", user }));
    socket.on("user:left", ({ userId }) => dispatch({ type: "userLeft", userId }));
    socket.on("cursor:moved", ({ userId, point }) => dispatch({ type: "cursor", userId, point }));
    socket.on("error:message", ({ message }) => dispatch({ type: "notice", message }));

    return () => {
      socket.disconnect();
    };
  }, [roomId, name]);

  // Points are buffered and sent at most every 40 ms, instead of one message per mouse event.
  useEffect(() => {
    const timer = setInterval(() => {
      const batch = pending.current;
      if (batch && batch.points.length) {
        socketRef.current?.emit("stroke:points", { strokeId: batch.strokeId, points: batch.points });
        pending.current = { strokeId: batch.strokeId, points: [] };
      }
    }, 40);
    return () => clearInterval(timer);
  }, []);

  const startStroke = useCallback(
    (point: Point, color: string, width: number): string => {
      const stroke: Stroke = { id: randomId(), userId: myId ?? "me", color, width, points: [point] };
      dispatch({ type: "strokeStart", stroke });
      socketRef.current?.emit("stroke:start", { id: stroke.id, color, width, points: [point] });
      pending.current = { strokeId: stroke.id, points: [] };
      return stroke.id;
    },
    [myId],
  );

  const extendStroke = useCallback((strokeId: string, point: Point) => {
    dispatch({ type: "strokePoints", strokeId, points: [point] });
    if (pending.current?.strokeId === strokeId) pending.current.points.push(point);
  }, []);

  const lastCursor = useRef(0);
  const moveCursor = useCallback((point: Point) => {
    const now = performance.now();
    if (now - lastCursor.current < 50) return; // ~20 updates per second is smooth enough
    lastCursor.current = now;
    socketRef.current?.emit("cursor:move", point);
  }, []);

  const undo = useCallback(() => socketRef.current?.emit("stroke:undo"), []);
  const clear = useCallback(() => socketRef.current?.emit("board:clear"), []);
  const dismissNotice = useCallback(() => dispatch({ type: "notice", message: null }), []);

  return { board, connected, myId, startStroke, extendStroke, moveCursor, undo, clear, dismissNotice };
}
