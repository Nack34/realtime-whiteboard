import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BoardState, ClientToServerEvents, ServerToClientEvents } from "../../shared/protocol";
import { createWhiteboardServer, type WhiteboardServer } from "../src/server";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: WhiteboardServer;
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  server = createWhiteboardServer();
  await new Promise<void>((resolve) => server.http.listen(0, resolve));
  url = `http://localhost:${(server.http.address() as AddressInfo).port}`;
});

afterEach(async () => {
  clients.splice(0).forEach((c) => c.disconnect());
  await server.close();
});

function once<E extends keyof ServerToClientEvents>(client: Client, event: E): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve) => client.once(event, ((payload: never) => resolve(payload)) as never));
}

async function joined(name: string, roomId = "room-1"): Promise<{ client: Client; state: BoardState }> {
  const client: Client = connect(url, { transports: ["websocket"] });
  clients.push(client);
  const state = once(client, "board:state");
  client.emit("room:join", { roomId, name });
  return { client, state: await state };
}

describe("whiteboard sockets", () => {
  it("sends the board state on join and announces new users", async () => {
    const { client: ana } = await joined("Ana");
    const announced = once(ana, "user:joined");
    const { state } = await joined("Beto");

    expect(state.users.map((u) => u.name)).toEqual(["Ana", "Beto"]);
    expect((await announced).name).toBe("Beto");
  });

  it("relays strokes to the other users and keeps them for late joiners", async () => {
    const { client: ana } = await joined("Ana");
    const { client: beto } = await joined("Beto");

    const started = once(beto, "stroke:start");
    ana.emit("stroke:start", { id: "s1", color: "#ff0000", width: 4, points: [{ x: 0.1, y: 0.2 }] });
    expect((await started).userId).toBe(ana.id);

    const moved = once(beto, "stroke:points");
    ana.emit("stroke:points", { strokeId: "s1", points: [{ x: 0.3, y: 0.4 }] });
    expect((await moved).points).toEqual([{ x: 0.3, y: 0.4 }]);

    const { state } = await joined("Carla");
    expect(state.strokes[0].points).toHaveLength(2);
  });

  it("ignores invalid payloads", async () => {
    const { client: ana } = await joined("Ana");
    ana.emit("stroke:start", { id: "bad", color: "red", width: 999, points: [{ x: 5, y: -1 }] });
    await new Promise((r) => setTimeout(r, 50));
    expect(server.rooms.state("room-1").strokes).toHaveLength(0);
  });

  it("rejects a bad room id with an error message", async () => {
    const client: Client = connect(url, { transports: ["websocket"] });
    clients.push(client);
    const error = once(client, "error:message");
    client.emit("room:join", { roomId: "../etc", name: "Eve" });
    expect((await error).message).toMatch(/invalid/i);
  });

  it("undo and clear are broadcast to everyone, including the sender", async () => {
    const { client: ana } = await joined("Ana");
    const { client: beto } = await joined("Beto");
    ana.emit("stroke:start", { id: "s1", color: "#00ff00", width: 2, points: [] });

    const removed = Promise.all([once(ana, "stroke:remove"), once(beto, "stroke:remove")]);
    ana.emit("stroke:undo");
    expect((await removed).map((p) => p.strokeId)).toEqual(["s1", "s1"]);

    const cleared = once(beto, "board:cleared");
    ana.emit("board:clear");
    expect((await cleared).by).toBe("Ana");
  });

  it("announces when a user leaves", async () => {
    const { client: ana } = await joined("Ana");
    const { client: beto } = await joined("Beto");
    const left = once(ana, "user:left");
    beto.disconnect();
    expect((await left).userId).toBeTruthy();
  });
});
