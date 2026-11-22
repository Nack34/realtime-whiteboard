import { useEffect, useState } from "react";
import { Canvas } from "./board/Canvas";
import { useWhiteboard } from "./board/useWhiteboard";

const COLORS = ["#1d2330", "#e4572e", "#2e86ab", "#3bb273", "#f3a712", "#a23b72"];

function roomFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  let room = params.get("room");
  if (!room || !/^[a-zA-Z0-9_-]{3,40}$/.test(room)) {
    room = Math.random().toString(36).slice(2, 10);
    params.set("room", room);
    window.history.replaceState(null, "", `?${params}`);
  }
  return room;
}

export default function App() {
  const [roomId] = useState(roomFromUrl);
  const [name, setName] = useState(() => sessionStorage.getItem("wb.name") ?? "");
  const [draft, setDraft] = useState(name);

  if (!name) {
    return (
      <main className="join">
        <form
          className="join-card"
          onSubmit={(e) => {
            e.preventDefault();
            const clean = draft.trim().slice(0, 30);
            if (!clean) return;
            sessionStorage.setItem("wb.name", clean);
            setName(clean);
          }}
        >
          <h1>Realtime whiteboard</h1>
          <p>
            Board <code>{roomId}</code>. Share the link to draw together.
          </p>
          <label>
            Your name
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={30} />
          </label>
          <button type="submit" disabled={!draft.trim()}>
            Join board
          </button>
        </form>
      </main>
    );
  }
  return <Board roomId={roomId} name={name} />;
}

function Board({ roomId, name }: { roomId: string; name: string }) {
  const wb = useWhiteboard(roomId, name);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(4);
  const [copied, setCopied] = useState(false);
  const { undo } = wb;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link", window.location.href);
    }
  };

  return (
    <div className="app">
      <header className="toolbar">
        <strong>Whiteboard</strong>
        <div className="swatches" role="radiogroup" aria-label="Color">
          {COLORS.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={c === color}
              aria-label={c}
              className={`swatch${c === color ? " active" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <label className="width">
          Size
          <input type="range" min={1} max={24} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
        </label>
        <button onClick={wb.undo} title="Undo your last stroke (Ctrl+Z)">
          Undo
        </button>
        <button
          onClick={() => {
            if (window.confirm("Clear the board for everyone?")) wb.clear();
          }}
        >
          Clear
        </button>
        <button onClick={copyLink}>{copied ? "Link copied" : "Copy link"}</button>
        <div className="users" aria-label="People on this board">
          {wb.board.users.map((u) => (
            <span key={u.id} className="avatar" style={{ background: u.color }} title={u.name}>
              {u.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
        <span className={`status${wb.connected ? " online" : ""}`}>{wb.connected ? "Live" : "Connecting…"}</span>
      </header>

      {wb.board.notice && (
        <div className="notice" role="status">
          {wb.board.notice}
          <button onClick={wb.dismissNotice} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <Canvas
        strokes={wb.board.strokes}
        cursors={wb.board.cursors}
        users={wb.board.users}
        myId={wb.myId}
        color={color}
        width={width}
        onStart={(p) => wb.startStroke(p, color, width)}
        onExtend={wb.extendStroke}
        onCursor={wb.moveCursor}
      />
    </div>
  );
}
