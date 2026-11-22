/**
 * Socket.IO protocol shared by the server and the client.
 * Only types live here, so both sides compile against the same contract.
 */

export interface Point {
  x: number; // 0..1, relative to the board width (so boards look the same on any screen size)
  y: number; // 0..1, relative to the board height
}

export interface Stroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  points: Point[];
}

export interface User {
  id: string;
  name: string;
  color: string;
}

export interface BoardState {
  roomId: string;
  strokes: Stroke[];
  users: User[];
}

export interface ServerToClientEvents {
  "board:state": (state: BoardState) => void;
  "stroke:start": (stroke: Stroke) => void;
  "stroke:points": (payload: { strokeId: string; points: Point[] }) => void;
  "stroke:remove": (payload: { strokeId: string }) => void;
  "board:cleared": (payload: { by: string }) => void;
  "user:joined": (user: User) => void;
  "user:left": (payload: { userId: string }) => void;
  "cursor:moved": (payload: { userId: string; point: Point }) => void;
  "error:message": (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  "room:join": (payload: { roomId: string; name: string }) => void;
  "stroke:start": (stroke: Omit<Stroke, "userId">) => void;
  "stroke:points": (payload: { strokeId: string; points: Point[] }) => void;
  "stroke:undo": () => void;
  "board:clear": () => void;
  "cursor:move": (point: Point) => void;
}
