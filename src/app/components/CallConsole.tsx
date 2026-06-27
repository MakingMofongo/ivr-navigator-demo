"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SCENARIOS, getScenario } from "@/engine/scenarios";
import { runCall, CallResult } from "@/engine/engine";
import { CallEvent, SlotName } from "@/engine/types";
import {
  buildStations,
  deriveChecklist,
  latestDetection,
  currentState,
  elapsedMs,
  formatClock,
  stateLabel,
} from "@/lib/view";
import Controls from "./Controls";
import CallFlow from "./CallFlow";
import DetectorPanel from "./DetectorPanel";
import AgentPanel from "./AgentPanel";

const MIN_DELAY = 120;
const MAX_DELAY = 2600;

const ROLE_TAG: Record<CallEvent["role"], string> = {
  ivr: "IVR",
  human: "Live rep",
  agent: "Agent",
  detector: "Detector",
  system: "System",
};

function Card({
  title,
  kicker,
  children,
  className,
}: {
  title?: string;
  kicker?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card${className ? ` ${className}` : ""}`}>
      {(title || kicker) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {kicker && <span className="card-kicker">{kicker}</span>}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

function FeedRow({ e }: { e: CallEvent }) {
  if (e.type === "notify") {
    return (
      <div className="feed-row feed-notify">
        <span className="notify-bell">🔔</span>
        <div>
          <strong>Desktop notification</strong>
          <p>{e.text}</p>
        </div>
      </div>
    );
  }

  const digit =
    e.type === "dtmf" && e.meta && typeof e.meta.digit === "string"
      ? (e.meta.digit as string)
      : null;

  return (
    <div className={`feed-row role-${e.role} type-${e.type}`}>
      <span className={`role-tag tag-${e.role}`}>{ROLE_TAG[e.role]}</span>
      <div className="feed-content">
        {digit && <span className="dtmf-chip">⌨ {digit}</span>}
        <span className="feed-text">{e.text}</span>
      </div>
    </div>
  );
}

export default function CallConsole() {
  const [selectedId, setSelectedId] = useState(SCENARIOS[0].id);
  const [result, setResult] = useState<CallResult | null>(null);
  const [playIndex, setPlayIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [notif, setNotif] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [toast, setToast] = useState<{ title: string; body: string } | null>(
    null,
  );

  const scenario = useMemo(() => getScenario(selectedId), [selectedId]);
  const feedRef = useRef<HTMLDivElement>(null);

  // Detect notification support once mounted (client only).
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotif(Notification.permission);
    } else {
      setNotif("unsupported");
    }
  }, []);

  const fireNotify = useCallback(
    (title: string, body: string) => {
      setToast({ title, body });
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(title, { body });
        } catch {
          /* some browsers block constructed notifications — toast still shows */
        }
      }
    },
    [],
  );

  // Playback loop: reveal one event at a time, paced by its timestamp.
  useEffect(() => {
    if (!running || !result) return;
    if (playIndex >= result.events.length) {
      setRunning(false);
      return;
    }
    const ev = result.events[playIndex];
    const prevT = playIndex > 0 ? result.events[playIndex - 1].t : 0;
    const delay = Math.min(
      MAX_DELAY,
      Math.max(MIN_DELAY, (ev.t - prevT) / speed),
    );
    const timer = setTimeout(() => {
      if (ev.type === "notify" && ev.meta) {
        fireNotify(
          (ev.meta.title as string) ?? "Live agent on the line",
          (ev.meta.body as string) ?? ev.text,
        );
      }
      setPlayIndex((i) => i + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [running, result, playIndex, speed, fireNotify]);

  // Auto-scroll the transcript as new rows land.
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [playIndex]);

  // Toast auto-dismiss.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleStart = useCallback(() => {
    const r = runCall(scenario);
    setResult(r);
    setPlayIndex(0);
    setToast(null);
    setRunning(true);
  }, [scenario]);

  const handleSelect = useCallback(
    (id: string) => {
      if (running) return;
      setSelectedId(id);
      setResult(null);
      setPlayIndex(0);
      setToast(null);
    },
    [running],
  );

  const handleEnableNotif = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    Notification.requestPermission().then((p) => setNotif(p));
  }, []);

  const revealed = useMemo(
    () => (result ? result.events.slice(0, playIndex) : []),
    [result, playIndex],
  );

  const stations = useMemo(
    () => (result ? buildStations(result.events) : []),
    [result],
  );
  const checklist = useMemo(() => deriveChecklist(revealed), [revealed]);
  const detection = useMemo(() => latestDetection(revealed), [revealed]);
  const callState = useMemo(() => currentState(revealed), [revealed]);
  const elapsed = useMemo(() => elapsedMs(revealed), [revealed]);
  const verifiedSlots = useMemo(() => {
    const out: SlotName[] = [];
    for (const e of revealed) {
      if (e.type === "action" && e.meta && "slot" in e.meta) {
        const s = e.meta.slot as SlotName;
        if (!out.includes(s)) out.push(s);
      }
    }
    return out;
  }, [revealed]);

  const done = !!result && playIndex >= result.events.length;
  const lastRevealedId = playIndex - 1;

  return (
    <div
      className="app"
      style={{ ["--accent" as string]: scenario.accent } as React.CSSProperties}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◐</span>
          <div className="brand-text">
            <h1>IVR Navigator</h1>
            <p>Outbound voice agent for insurer support lines</p>
          </div>
        </div>
        <div className="topbar-right">
          <span className="sim-badge" title="Telephony is simulated for this demo. The navigation + detection logic is real.">
            simulated telephony · real agent logic
          </span>
          <a
            className="repo-link"
            href="https://github.com/MakingMofongo/ivr-navigator-demo"
            target="_blank"
            rel="noreferrer"
          >
            source ↗
          </a>
        </div>
      </header>

      <Controls
        scenarios={SCENARIOS}
        selectedId={selectedId}
        onSelect={handleSelect}
        onStart={handleStart}
        running={running}
        done={done}
        speed={speed}
        onSpeed={setSpeed}
        notif={notif}
        onEnableNotif={handleEnableNotif}
      />

      <section className="callbar">
        <div className="callbar-main">
          <span className={`status-dot status-${callState}${running ? " live" : ""}`} />
          <div className="callbar-id">
            <strong>{scenario.insurer}</strong>
            <span className="callbar-phone">{scenario.phoneNumber}</span>
          </div>
        </div>
        <div className="callbar-goal">
          <span className="callbar-kicker">Goal</span>
          <span>{scenario.goal}</span>
        </div>
        <div className="callbar-meta">
          <div className="meta-block">
            <span className="callbar-kicker">Status</span>
            <span className="status-text">{stateLabel(callState)}</span>
          </div>
          <div className="meta-block">
            <span className="callbar-kicker">Call time</span>
            <span className="clock">{formatClock(elapsed)}</span>
          </div>
        </div>
      </section>

      <main className="grid">
        <aside className="col col-left">
          <Card title="Call flow" kicker="agent path">
            <CallFlow stations={stations} lastRevealedId={lastRevealedId} />
          </Card>
          <Card title="Agent">
            <AgentPanel
              scenario={scenario}
              checklist={checklist}
              verifiedSlots={verifiedSlots}
            />
          </Card>
        </aside>

        <section className="col col-center">
          <Card title="Live transcript" kicker="real-time" className="feed-card">
            <div className="feed" ref={feedRef}>
              {revealed.length === 0 ? (
                <div className="feed-empty">
                  <p className="feed-empty-title">No call in progress.</p>
                  <p>
                    Pick a target and press{" "}
                    <strong>Start outbound call</strong>. The agent will dial,
                    work through the phone tree key by key, ride out the hold,
                    detect the moment a real person picks up, answer their
                    verification questions from the case file, and bridge your
                    staff onto the line.
                  </p>
                </div>
              ) : (
                revealed.map((e) => <FeedRow key={e.id} e={e} />)
              )}
              {done && result?.summary.bridged && (
                <div className="feed-summary">
                  <span className="summary-check">✓ Call complete</span>
                  <p>
                    Navigated {result.summary.menuHops} menu steps, held through{" "}
                    {result.summary.holdEvents} queue
                    {result.summary.holdEvents > 1 ? "s" : ""}, detected a live
                    rep, verified {result.summary.slotsVerified.length} data
                    points, and bridged <strong>{result.summary.bridgeTarget}</strong>{" "}
                    onto the call in {formatClock(result.summary.durationMs)}.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </section>

        <aside className="col col-right">
          <Card title="Detection" kicker="menu vs human">
            <DetectorPanel detection={detection} />
          </Card>
          <Card title="How this maps to the build" kicker="for the real thing">
            <ul className="how-list">
              <li>
                <strong>Telephony</strong> — Twilio places the outbound call and
                streams audio; this demo simulates that layer.
              </li>
              <li>
                <strong>Voice + turn-taking</strong> — Bland AI (or
                Deepgram&nbsp;+ an LLM) handles speech; the detector and
                navigation logic you&apos;re watching are the real decision
                engine on top.
              </li>
              <li>
                <strong>Bridge + alert</strong> — on a confirmed human, the call
                warm-transfers to your staff and fires a desktop notification.
              </li>
            </ul>
            <p className="how-note">
              To make it dial for real I&apos;d need a Twilio SID + auth token
              and a number, plus a Bland AI key. Everything else is built.
            </p>
          </Card>
        </aside>
      </main>

      {toast && (
        <div className="toast" role="status">
          <span className="toast-bell">🔔</span>
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.body}</p>
          </div>
        </div>
      )}
    </div>
  );
}
