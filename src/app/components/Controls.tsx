import { Scenario } from "@/engine/types";

interface Props {
  scenarios: Scenario[];
  selectedId: string;
  onSelect: (id: string) => void;
  onStart: () => void;
  running: boolean;
  done: boolean;
  speed: number;
  onSpeed: (s: number) => void;
  notif: NotificationPermission | "unsupported";
  onEnableNotif: () => void;
}

const SPEEDS = [0.5, 1, 2, 4];

export default function Controls({
  scenarios,
  selectedId,
  onSelect,
  onStart,
  running,
  done,
  speed,
  onSpeed,
  notif,
  onEnableNotif,
}: Props) {
  return (
    <div className="controls">
      <div className="control-group scenarios">
        <span className="control-label">Call target</span>
        <div className="scenario-pills">
          {scenarios.map((s) => (
            <button
              key={s.id}
              className={`pill${s.id === selectedId ? " pill-active" : ""}`}
              onClick={() => onSelect(s.id)}
              disabled={running}
              style={
                s.id === selectedId
                  ? ({ "--pill-accent": s.accent } as React.CSSProperties)
                  : undefined
              }
            >
              <span className="pill-dot" style={{ background: s.accent }} />
              <span className="pill-text">
                <strong>{s.insurer}</strong>
                <small>{s.vertical}</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <span className="control-label">Playback</span>
        <div className="speed-row">
          {SPEEDS.map((sp) => (
            <button
              key={sp}
              className={`chip${sp === speed ? " chip-active" : ""}`}
              onClick={() => onSpeed(sp)}
            >
              {sp}×
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <span className="control-label">Desktop alert</span>
        <button
          className={`chip${notif === "granted" ? " chip-on" : ""}`}
          onClick={onEnableNotif}
          disabled={notif === "unsupported"}
          title="Fires a real browser notification when the call bridges"
        >
          {notif === "granted"
            ? "● Enabled"
            : notif === "unsupported"
              ? "Unsupported"
              : "Enable"}
        </button>
      </div>

      <div className="control-group grow-end">
        <button className="cta" onClick={onStart} disabled={running}>
          {running ? (
            <>
              <span className="spinner" /> Call in progress…
            </>
          ) : done ? (
            "↻ Run call again"
          ) : (
            "▸ Start outbound call"
          )}
        </button>
      </div>
    </div>
  );
}
