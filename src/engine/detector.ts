// Live-human-vs-recording detector.
//
// This is the hard part of the gig: deciding, from a transcript of whatever the
// far end just said, whether we are talking to (a) an automated IVR menu,
// (b) a hold queue, or (c) an actual live representative — so the agent knows
// when to stop pressing buttons and start talking like a person.
//
// The implementation is a transparent feature/keyword scorer. It runs on real
// transcripts (e.g. Deepgram/ASR output) with zero dependencies and is fully
// explainable — every decision exposes which phrases fired and how much they
// weighed. In production this is the bootstrap layer you ship before you have
// enough labelled call audio to train an ML classifier; the agent code treats
// `detect()` as a swappable interface, so a model can drop in behind it later.

import { DetectorResult, DetectorLabel, DetectorFeature } from "./types";
import { round } from "./util";

interface Signal {
  label: DetectorLabel;
  feature: string;
  weight: number;
  patterns: RegExp[];
}

// Ordered roughly by how decisive each cue is.
const SIGNALS: Signal[] = [
  // ----- MENU (automated, expects DTMF) -----
  {
    label: "menu",
    feature: "dtmf_instruction",
    weight: 3.0,
    patterns: [
      /\bpress\s+(one|two|three|four|five|six|seven|eight|nine|zero|\d|pound|star)\b/i,
      /\bfor\s+[^.,]+,?\s+press\b/i,
      /\bto\s+[^.,]+,?\s+press\b/i,
    ],
  },
  {
    label: "menu",
    feature: "menu_framing",
    weight: 1.6,
    patterns: [
      /\bmain menu\b/i,
      /\bprevious menu\b/i,
      /\bthe following options\b/i,
      /\blisten carefully\b/i,
      /\b(menu )?options have (recently )?changed\b/i,
      /\breturn to the (main )?menu\b/i,
    ],
  },
  {
    label: "menu",
    feature: "ivr_boilerplate",
    weight: 1.1,
    patterns: [
      /\bpara español\b/i,
      /\bplease enter your\b/i,
      /\busing your (touch.?tone|keypad)\b/i,
      /\bthis call may be (recorded|monitored)\b/i,
      /\bautomated (system|attendant|assistant)\b/i,
    ],
  },
  // ----- HOLD (queue / wait) -----
  {
    label: "hold",
    feature: "queue_language",
    weight: 3.0,
    patterns: [
      /\ball (of )?our (representatives|agents|specialists|associates) are (currently )?(busy|assisting|helping)\b/i,
      /\bplease (stay on the line|continue to hold|hold)\b/i,
      /\bremain on the line\b/i,
    ],
  },
  {
    label: "hold",
    feature: "wait_estimate",
    weight: 1.8,
    patterns: [
      /\b(estimated|approximate|expected) wait( time)?\b/i,
      /\bhigh(er than normal)? call volume\b/i,
      /\byou are (caller )?number \w+\b/i,
      /\bin the order (it|they) (was|were) received\b/i,
      /\bthank you for your patience\b/i,
    ],
  },
  // ----- HUMAN (live rep) -----
  {
    label: "human",
    feature: "live_greeting",
    weight: 2.6,
    patterns: [
      /\bthank(s| you) for calling[^.]*\bthis is\b/i,
      /\bmy name is\b/i,
      /\bthis is \w+ speaking\b/i,
      /\byou(['’]re| are) (now )?speaking (with|to)\b/i,
    ],
  },
  {
    label: "human",
    feature: "offer_to_help",
    weight: 2.2,
    patterns: [
      /\bhow (can|may) i help\b/i,
      /\bwhat can i (do|help you with)\b/i,
      /\bhow can i assist\b/i,
      /\bare you calling (about|regarding)\b/i,
      /\bwho do i have the pleasure\b/i,
    ],
  },
  {
    label: "human",
    feature: "verification_request",
    weight: 1.7,
    patterns: [
      /\bcan i (get|have) your\b/i,
      /\bmay i (please )?have your\b/i,
      /\bcould you (please )?(verify|confirm|provide|spell)\b/i,
      /\bwhat[''’]?s the (member|claim|policy|date|dob|name|provider|callback|phone|account)\b/i,
      /\bwhich (provider|doctor|office|clinic|date)\b/i,
      /\b(callback|phone|account|policy|member|claim|reference) number\b/i,
      /\b(date of birth|d\.?o\.?b)\b/i,
    ],
  },
  {
    label: "human",
    feature: "disfluency",
    weight: 1.0,
    patterns: [
      /\b(um+|uh+|let me|one sec(ond)?|bear with me|give me (a|one) (second|moment))\b/i,
      /\b(pull(ing)? (that|it|you) up|let me check|looking that up)\b/i,
      /\b(okay|alright|gotcha|no problem|sure thing|of course)\b/i,
    ],
  },
];

// Treat empty / hold-music / pure-pause transcripts as silence.
const SILENCE_RE = /^\s*(\[silence\]|\[hold music\]|\[music\]|\.+|—+)?\s*$/i;

// A small prior so an unambiguous single-signal line doesn't read as a fake
// 100%. It also becomes the winner when nothing else fires.
const UNKNOWN_PRIOR = 0.4;

function emptyScores(): Record<DetectorLabel, number> {
  return { menu: 0, hold: 0, human: 0, silence: 0, unknown: UNKNOWN_PRIOR };
}

/**
 * Classify a single transcript chunk from the far end of the call.
 */
export function detect(transcript: string): DetectorResult {
  const scores = emptyScores();

  if (SILENCE_RE.test(transcript)) {
    scores.silence = 1.5;
    return finalize(scores, [], "no speech detected — holding");
  }

  const features: DetectorFeature[] = [];

  for (const sig of SIGNALS) {
    const matched: string[] = [];
    for (const re of sig.patterns) {
      const m = transcript.match(re);
      if (m) matched.push(m[0].trim());
    }
    if (matched.length > 0) {
      // Diminishing returns for multiple matches of the same feature.
      const contribution = sig.weight * (1 + 0.15 * (matched.length - 1));
      scores[sig.label] += contribution;
      features.push({
        label: sig.label,
        name: sig.feature,
        weight: round(contribution),
        matched,
      });
    }
  }

  // A direct question aimed at the caller is a soft human cue.
  const directQuestion =
    /\?/.test(transcript) &&
    /\b(can|could|may|what|when|who|how|do|did|is|are)\b[^?]*\byou(r)?\b/i.test(
      transcript,
    );
  if (directQuestion) {
    scores.human += 0.8;
    features.push({
      label: "human",
      name: "asks_caller_question",
      weight: 0.8,
      matched: ["?"],
    });
  }

  features.sort((a, b) => b.weight - a.weight);

  const rationale = features.length
    ? `top cue: ${features[0].name} (${features[0].label})`
    : "no strong cues — uncertain";

  return finalize(scores, features, rationale);
}

function finalize(
  scores: Record<DetectorLabel, number>,
  features: DetectorFeature[],
  rationale: string,
): DetectorResult {
  let label: DetectorLabel = "unknown";
  let best = -Infinity;
  let total = 0;
  for (const k of Object.keys(scores) as DetectorLabel[]) {
    total += scores[k];
    if (scores[k] > best) {
      best = scores[k];
      label = k;
    }
  }
  const confidence = total > 0 ? round(best / total, 3) : 0;
  // round stored scores for clean display
  const rounded = { ...scores };
  for (const k of Object.keys(rounded) as DetectorLabel[]) {
    rounded[k] = round(rounded[k]);
  }
  return {
    label,
    confidence,
    scores: rounded,
    topFeatures: features.slice(0, 4),
    rationale,
  };
}
