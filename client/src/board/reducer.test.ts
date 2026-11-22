import { describe, expect, it } from "vitest";
import { boardReducer, emptyBoard, toBoardPoint } from "./reducer";

const stroke = { id: "s1", userId: "u1", color: "#000000", width: 2, points: [{ x: 0, y: 0 }] };
const ana = { id: "u1", name: "Ana", color: "#e4572e" };

describe("boardReducer", () => {
  it("loads the initial state", () => {
    const board = boardReducer(emptyBoard, { type: "state", state: { roomId: "r", strokes: [stroke], users: [ana] } });
    expect(board.strokes).toHaveLength(1);
    expect(board.users).toEqual([ana]);
  });

  it("adds, extends and removes strokes immutably", () => {
    const started = boardReducer(emptyBoard, { type: "strokeStart", stroke });
    const extended = boardReducer(started, { type: "strokePoints", strokeId: "s1", points: [{ x: 1, y: 1 }] });
    expect(extended.strokes[0].points).toHaveLength(2);
    expect(started.strokes[0].points).toHaveLength(1); // previous state untouched
    expect(boardReducer(extended, { type: "strokeRemove", strokeId: "s1" }).strokes).toEqual([]);
  });

  it("ignores a duplicate stroke start (our own echo)", () => {
    const once = boardReducer(emptyBoard, { type: "strokeStart", stroke });
    expect(boardReducer(once, { type: "strokeStart", stroke })).toBe(once);
  });

  it("clears the board with a notice", () => {
    const board = boardReducer({ ...emptyBoard, strokes: [stroke] }, { type: "cleared", by: "Ana" });
    expect(board.strokes).toEqual([]);
    expect(board.notice).toBe("Ana cleared the board");
  });

  it("removes a leaving user's cursor", () => {
    let board = boardReducer(emptyBoard, { type: "userJoined", user: ana });
    board = boardReducer(board, { type: "cursor", userId: "u1", point: { x: 0.5, y: 0.5 } });
    board = boardReducer(board, { type: "userLeft", userId: "u1" });
    expect(board.users).toEqual([]);
    expect(board.cursors).toEqual({});
  });
});

describe("toBoardPoint", () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };
  it("maps pointer coordinates to 0..1", () => {
    expect(toBoardPoint(200, 100, rect)).toEqual({ x: 0.5, y: 0.5 });
  });
  it("clamps points outside the board", () => {
    expect(toBoardPoint(0, 1000, rect)).toEqual({ x: 0, y: 1 });
  });
});
