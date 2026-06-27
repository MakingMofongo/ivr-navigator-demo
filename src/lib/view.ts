// Pure helpers that turn the engine's CallEvent stream into the view-state the
// UI renders. Kept separate (and side-effect free) so the components stay dumb.

import { CallEvent, CallState, DetectorResult } from "@/engine/types";

const NODE_NAMES: Record<string, string> = {
  main: "Main menu",
  claims: "Claims",
  verify: "Identify account",
  reach_agent: "Request a rep",
  auth: "Authorizations",
  imaging: "Imaging",
  confirm: "Auth status",
  auto: "Auto claims",
  topic: "Claim topic",
};

export function friendlyNode(id: string): string {
  return (
    NODE_NAMES[id] ??
    id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export type StationKind = "menu" | "hold" | "human" | "bridge";

export interface Station {
  key: string;
  label: string;
  sub: string;
  kind: StationKind;
  revealAt: number; // event id at which this station becomes active
}

/** Build the call-flow map (the path the agent actually took). */
export function buildStations(events: CallEvent[]): Station[] {
  const stations: Station[] = [];
  const seenHold = new Set<string>();
  let seenHuman = false;
  let seenBridge = false;

  for (const e of events) {
    if (e.type === "dtmf" && e.nodeId) {
      const m = /Pressing (\S+) — (.+)/.exec(e.text);
      stations.push({
        key: `menu-${e.id}`,
        label: friendlyNode(e.nodeId),
        sub: m ? `pressed ${m[1]} · ${m[2]}` : "pressed",
        kind: "menu",
        revealAt: e.id,
      });
    } else if (
      e.type === "state" &&
      e.state === "on_hold" &&
      e.nodeId &&
      !seenHold.has(e.nodeId)
    ) {
      seenHold.add(e.nodeId);
      stations.push({
        key: `hold-${e.id}`,
        label: "Hold queue",
        sub: "stayed on the line",
        kind: "hold",
        revealAt: e.id,
      });
    } else if (e.type === "state" && e.state === "live_human" && !seenHuman) {
      seenHuman = true;
      stations.push({
        key: `human-${e.id}`,
        label: "Live representative",
        sub: "detected · verifying identity",
        kind: "human",
        revealAt: e.id,
      });
    } else if (e.type === "state" && e.state === "bridged" && !seenBridge) {
      seenBridge = true;
      stations.push({
        key: `bridge-${e.id}`,
        label: "Bridged to staff",
        sub: "desktop alert fired",
        kind: "bridge",
        revealAt: e.id,
      });
    }
  }
  return stations;
}

export interface Checklist {
  dialed: boolean;
  navigated: boolean;
  recoveredHold: boolean;
  liveRep: boolean;
  verified: boolean;
  bridged: boolean;
  menuHops: number;
}

export function deriveChecklist(revealed: CallEvent[]): Checklist {
  let dialed = false;
  let navigated = false;
  let sawHold = false;
  let recoveredHold = false;
  let liveRep = false;
  let verified = false;
  let bridged = false;
  let menuHops = 0;

  for (const e of revealed) {
    if (e.state === "dialing" || e.state === "ringing") dialed = true;
    if (e.type === "dtmf") {
      navigated = true;
      menuHops += 1;
    }
    if (e.state === "on_hold") sawHold = true;
    if (e.state === "live_human") {
      liveRep = true;
      if (sawHold) recoveredHold = true;
    }
    if (e.type === "action" && e.meta && "slot" in e.meta) verified = true;
    if (e.state === "bridging") verified = true;
    if (e.state === "bridged") bridged = true;
  }

  return {
    dialed,
    navigated,
    recoveredHold,
    liveRep,
    verified,
    bridged,
    menuHops,
  };
}

const STATE_OF_RECORD: CallState = "idle";

export function currentState(revealed: CallEvent[]): CallState {
  for (let i = revealed.length - 1; i >= 0; i--) {
    if (revealed[i].state) return revealed[i].state as CallState;
  }
  return STATE_OF_RECORD;
}

export function latestDetection(revealed: CallEvent[]): DetectorResult | null {
  for (let i = revealed.length - 1; i >= 0; i--) {
    if (revealed[i].detection) return revealed[i].detection as DetectorResult;
  }
  return null;
}

export function elapsedMs(revealed: CallEvent[]): number {
  return revealed.length ? revealed[revealed.length - 1].t : 0;
}

export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const STATE_LABELS: Record<CallState, string> = {
  idle: "Idle",
  dialing: "Dialing",
  ringing: "Ringing",
  ivr_menu: "In IVR menu",
  navigating: "Navigating",
  on_hold: "On hold",
  live_human: "Live rep",
  answering: "Answering",
  bridging: "Bridging",
  bridged: "Bridged",
  completed: "Completed",
  failed: "Failed",
};

export function stateLabel(s: CallState): string {
  return STATE_LABELS[s] ?? s;
}
