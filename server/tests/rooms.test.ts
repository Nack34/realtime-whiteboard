import { describe, expect, it } from "vitest";
import { LIMITS, RoomStore } from "../src/rooms";

const ana = { id: "u1", name: "Ana", color: "#000000" };
const beto = { id: "u2", name: "Beto", color: "#ffffff" };
const stroke = (id: string, userId: string) => ({ id, userId, color: "#ff0000", width: 3, points: [{ x: 0.1, y: 0.1 }] });

describe("RoomStore", () => {
  it("returns the current board when someone joins", () => {
    const store = new RoomStore();
    store.join("r1", ana);
    store.startStroke("r1", stroke("s1", ana.id));
    const state = store.join("r1", beto);
    expect(state.users.map((u) => u.name)).toEqual(["Ana", "Beto"]);
    expect(state.strokes).toHaveLength(1);
  });

  it("only lets users add points to their own strokes", () => {
    const store = new RoomStore();
    store.startStroke("r1", stroke("s1", ana.id));
    expect(store.addPoints("r1", beto.id, "s1", [{ x: 0.5, y: 0.5 }])).toEqual([]);
    expect(store.addPoints("r1", ana.id, "s1", [{ x: 0.5, y: 0.5 }])).toHaveLength(1);
    expect(store.state("r1").strokes[0].points).toHaveLength(2);
  });

  it("rejects duplicate stroke ids", () => {
    const store = new RoomStore();
    expect(store.startStroke("r1", stroke("s1", ana.id))).toBe(true);
    expect(store.startStroke("r1", stroke("s1", ana.id))).toBe(false);
  });

  it("caps points per stroke", () => {
    const store = new RoomStore();
    store.startStroke("r1", stroke("s1", ana.id));
    const many = Array.from({ length: LIMITS.pointsPerStroke + 10 }, () => ({ x: 0.2, y: 0.2 }));
    const added = store.addPoints("r1", ana.id, "s1", many);
    expect(added).toHaveLength(LIMITS.pointsPerStroke - 1);
  });

  it("undo removes the user's latest stroke, not someone else's", () => {
    const store = new RoomStore();
    store.startStroke("r1", stroke("a1", ana.id));
    store.startStroke("r1", stroke("a2", ana.id));
    store.startStroke("r1", stroke("b1", beto.id));
    expect(store.undo("r1", ana.id)).toBe("a2");
    expect(store.state("r1").strokes.map((s) => s.id)).toEqual(["a1", "b1"]);
    expect(store.undo("r1", "nobody")).toBeNull();
  });

  it("sweeps rooms that have been empty longer than the TTL", () => {
    let now = 0;
    const store = new RoomStore(() => now);
    store.join("r1", ana);
    store.join("r2", beto);
    store.leave("r1", ana.id);
    now = 1000;
    expect(store.sweep(500)).toBe(1);
    expect(store.size).toBe(1); // r2 still has a user
  });

  it("refuses new users when the room is full", () => {
    const store = new RoomStore();
    for (let i = 0; i < LIMITS.usersPerRoom; i++) store.join("r1", { ...ana, id: `u${i}` });
    expect(() => store.join("r1", { ...ana, id: "extra" })).toThrow("full");
  });
});
