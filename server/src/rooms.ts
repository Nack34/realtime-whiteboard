import type { BoardState, Point, Stroke, User } from "../../shared/protocol";

export const LIMITS = {
  strokesPerRoom: 2000,
  pointsPerStroke: 5000,
  usersPerRoom: 20,
};

interface Room {
  id: string;
  strokes: Stroke[];
  users: Map<string, User>;
  emptySince: number | null;
}

/**
 * In-memory board state. Pure logic with no Socket.IO in it, so it can be unit-tested directly.
 * A room lives while it has users and is dropped some time after the last one leaves.
 */
export class RoomStore {
  private rooms = new Map<string, Room>();

  constructor(private now: () => number = Date.now) {}

  private room(roomId: string): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = { id: roomId, strokes: [], users: new Map(), emptySince: null };
      this.rooms.set(roomId, room);
    }
    return room;
  }

  join(roomId: string, user: User): BoardState {
    const room = this.room(roomId);
    if (room.users.size >= LIMITS.usersPerRoom && !room.users.has(user.id)) {
      throw new Error("This board is full");
    }
    room.users.set(user.id, user);
    room.emptySince = null;
    return this.state(roomId);
  }

  leave(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.users.delete(userId);
    if (room.users.size === 0) room.emptySince = this.now();
  }

  state(roomId: string): BoardState {
    const room = this.room(roomId);
    return { roomId, strokes: room.strokes, users: [...room.users.values()] };
  }

  startStroke(roomId: string, stroke: Stroke): boolean {
    const room = this.room(roomId);
    if (room.strokes.length >= LIMITS.strokesPerRoom) return false;
    if (room.strokes.some((s) => s.id === stroke.id)) return false;
    room.strokes.push({ ...stroke, points: stroke.points.slice(0, LIMITS.pointsPerStroke) });
    return true;
  }

  /** Appends points to a stroke, only if it belongs to the user. Returns the points actually added. */
  addPoints(roomId: string, userId: string, strokeId: string, points: Point[]): Point[] {
    const stroke = this.room(roomId).strokes.find((s) => s.id === strokeId);
    if (!stroke || stroke.userId !== userId) return [];
    const remaining = LIMITS.pointsPerStroke - stroke.points.length;
    const added = points.slice(0, Math.max(0, remaining));
    stroke.points.push(...added);
    return added;
  }

  /** Removes the user's most recent stroke (each user can only undo their own drawing). */
  undo(roomId: string, userId: string): string | null {
    const strokes = this.room(roomId).strokes;
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (strokes[i].userId === userId) {
        const [removed] = strokes.splice(i, 1);
        return removed.id;
      }
    }
    return null;
  }

  clear(roomId: string): void {
    this.room(roomId).strokes = [];
  }

  /** Deletes rooms that have been empty for longer than `ttlMs`. Returns how many were removed. */
  sweep(ttlMs: number): number {
    let removed = 0;
    for (const [id, room] of this.rooms) {
      if (room.emptySince !== null && this.now() - room.emptySince >= ttlMs) {
        this.rooms.delete(id);
        removed++;
      }
    }
    return removed;
  }

  get size(): number {
    return this.rooms.size;
  }
}
