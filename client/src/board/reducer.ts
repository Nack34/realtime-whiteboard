import type { BoardState, Point, Stroke, User } from "../../../shared/protocol";

export interface LocalBoard {
  strokes: Stroke[];
  users: User[];
  cursors: Record<string, Point>;
  notice: string | null;
}

export type BoardAction =
  | { type: "state"; state: BoardState }
  | { type: "strokeStart"; stroke: Stroke }
  | { type: "strokePoints"; strokeId: string; points: Point[] }
  | { type: "strokeRemove"; strokeId: string }
  | { type: "cleared"; by: string }
  | { type: "userJoined"; user: User }
  | { type: "userLeft"; userId: string }
  | { type: "cursor"; userId: string; point: Point }
  | { type: "notice"; message: string | null };

export const emptyBoard: LocalBoard = { strokes: [], users: [], cursors: {}, notice: null };

/** All board changes go through this pure function, so they're easy to test and reason about. */
export function boardReducer(board: LocalBoard, action: BoardAction): LocalBoard {
  switch (action.type) {
    case "state":
      return { ...board, strokes: action.state.strokes, users: action.state.users };
    case "strokeStart":
      if (board.strokes.some((s) => s.id === action.stroke.id)) return board;
      return { ...board, strokes: [...board.strokes, action.stroke] };
    case "strokePoints":
      return {
        ...board,
        strokes: board.strokes.map((s) =>
          s.id === action.strokeId ? { ...s, points: [...s.points, ...action.points] } : s,
        ),
      };
    case "strokeRemove":
      return { ...board, strokes: board.strokes.filter((s) => s.id !== action.strokeId) };
    case "cleared":
      return { ...board, strokes: [], notice: `${action.by} cleared the board` };
    case "userJoined":
      return { ...board, users: [...board.users.filter((u) => u.id !== action.user.id), action.user] };
    case "userLeft": {
      const { [action.userId]: _gone, ...cursors } = board.cursors;
      return { ...board, users: board.users.filter((u) => u.id !== action.userId), cursors };
    }
    case "cursor":
      return { ...board, cursors: { ...board.cursors, [action.userId]: action.point } };
    case "notice":
      return { ...board, notice: action.message };
  }
}

/** Converts a pointer position to board coordinates in the 0..1 range. */
export function toBoardPoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): Point {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    x: clamp((clientX - rect.left) / rect.width),
    y: clamp((clientY - rect.top) / rect.height),
  };
}

export function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
