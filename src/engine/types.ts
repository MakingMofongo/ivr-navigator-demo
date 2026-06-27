// Shared types for the IVR navigation engine.

export type CallState =
  | "idle"
  | "dialing"
  | "ringing"
  | "ivr_menu"
  | "navigating"
  | "on_hold"
  | "live_human"
  | "answering"
  | "bridging"
  | "bridged"
  | "completed"
  | "failed";

export type SpeakerRole = "ivr" | "agent" | "human" | "detector" | "system";

export type DetectorLabel = "menu" | "hold" | "human" | "silence" | "unknown";

export interface DetectorFeature {
  /** Label this feature votes for. */
  label: DetectorLabel;
  /** Human-readable feature name, e.g. "dtmf_instruction". */
  name: string;
  /** Score contribution from this feature. */
  weight: number;
  /** Concrete substrings that matched (for explainability). */
  matched: string[];
}

export interface DetectorResult {
  label: DetectorLabel;
  /** 0..1 confidence in the winning label. */
  confidence: number;
  scores: Record<DetectorLabel, number>;
  /** Features that fired, sorted by contribution. */
  topFeatures: DetectorFeature[];
  rationale: string;
}

// --- IVR graph -------------------------------------------------------------

export interface MenuOption {
  digit: string; // "1".."9", "0", "#", "*"
  label: string; // "Claims"
  intents: string[]; // intents this option satisfies
  next: string; // next node id
}

export interface MenuNode {
  id: string;
  type: "menu";
  prompt: string; // the spoken IVR transcript
  options: MenuOption[];
}

export interface HoldNode {
  id: string;
  type: "hold";
  prompt: string;
  holdSeconds: number; // simulated wait
  next: string;
}

export type SlotName =
  | "member_id"
  | "member_name"
  | "date_of_birth"
  | "claim_number"
  | "reason_for_call"
  | "callback_number"
  | "provider_name"
  | "date_of_service";

export interface HumanTurn {
  text: string; // what the rep says
  asks?: SlotName; // info the rep is requesting, if any
  expectsBridge?: boolean; // after this turn the agent may bridge in staff
}

export interface HumanNode {
  id: string;
  type: "human";
  repName: string;
  turns: HumanTurn[];
}

export type IvrNode = MenuNode | HoldNode | HumanNode;

export interface CaseContext {
  member_id: string;
  member_name: string;
  date_of_birth: string;
  claim_number: string;
  reason_for_call: string;
  callback_number: string;
  provider_name: string;
  date_of_service: string;
}

export interface Scenario {
  id: string;
  insurer: string;
  vertical: string; // "Health", "Auto", ...
  phoneNumber: string;
  accent: string; // theme color hex
  goal: string;
  goalIntents: string[];
  caseContext: CaseContext;
  startNode: string;
  nodes: Record<string, IvrNode>;
  bridgeTarget: string; // client-side staff member to bridge in
}

// --- Call event stream -----------------------------------------------------

export type EventType =
  | "state"
  | "transcript"
  | "dtmf"
  | "detection"
  | "action"
  | "note"
  | "notify";

export interface CallEvent {
  id: number;
  t: number; // ms since call start (for timed playback)
  role: SpeakerRole;
  type: EventType;
  text: string;
  state?: CallState;
  detection?: DetectorResult;
  nodeId?: string;
  meta?: Record<string, unknown>;
}
