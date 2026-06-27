// The navigation agent: the decision-making half of the system.
//
// Two real jobs:
//  1. chooseOption() — given an IVR menu and the call's goal, pick which key to
//     press. This is keyword/intent matching between the goal and each option,
//     with a bonus for declared intent hits. It returns the full ranking so the
//     UI can show *why* a digit was chosen.
//  2. answerSlot() — when a live rep asks a verification question ("can I get
//     your member ID?"), figure out which field they want and pull it from the
//     case file. This is lightweight slot-filling / intent classification.
//
// Both are pure functions, so the whole agent is unit-testable without any
// telephony, browser, or LLM dependency.

import { MenuNode, MenuOption, CaseContext, SlotName } from "./types";
import { tokenize, overlap, round } from "./util";

export interface RankedOption {
  digit: string;
  label: string;
  score: number;
}

export interface MenuDecision {
  option: MenuOption;
  ranked: RankedOption[];
  reason: string;
}

/**
 * Pick the menu option that best advances the goal.
 */
export function chooseOption(
  menu: MenuNode,
  goalIntents: string[],
  goalText: string,
): MenuDecision {
  const goalTokens = tokenize(`${goalText} ${goalIntents.join(" ")}`);

  const scored = menu.options.map((option) => {
    const optTokens = tokenize(`${option.label} ${option.intents.join(" ")}`);
    let score = overlap(goalTokens, optTokens);
    // Strong bonus when an option explicitly declares one of the goal intents.
    for (const gi of goalIntents) {
      if (option.intents.includes(gi)) score += 2.5;
    }
    return { option, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const ranked: RankedOption[] = scored.map((s) => ({
    digit: s.option.digit,
    label: s.option.label,
    score: round(s.score),
  }));

  const winner = scored[0];
  const runnerUp = scored[1];
  const margin = winner.score - (runnerUp ? runnerUp.score : 0);
  const reason =
    margin > 0
      ? `"${winner.option.label}" matches goal best (lead +${round(margin)} over "${
          runnerUp?.option.label ?? "n/a"
        }")`
      : `defaulting to "${winner.option.label}" (no strong match)`;

  return { option: winner.option, ranked, reason };
}

interface SlotMatcher {
  slot: SlotName;
  re: RegExp;
}

// Ordered most-specific first so e.g. "claim number" wins over a bare "number".
const SLOT_MATCHERS: SlotMatcher[] = [
  {
    slot: "claim_number",
    re: /\b(claim|authorization|auth|reference)\s*(number|id|#|num)\b|\b(claim|authorization|auth)\b[^?.,]{0,25}\bnumber\b/i,
  },
  {
    slot: "member_id",
    re: /\b(member|subscriber|policy|patient)\s*(id|number|i\.?d\.?|#)\b|\bid (number|on (the|your) card)\b/i,
  },
  {
    slot: "date_of_birth",
    re: /\b(date of birth|d\.?o\.?b|birth ?date|birthday|when (were|was).*born)\b/i,
  },
  {
    slot: "date_of_service",
    re: /\b(date of service|service date|when (was|were)[^?]*(seen|service|visit|procedure))\b/i,
  },
  {
    slot: "provider_name",
    re: /\b(provider|doctor|physician|facility|which (office|clinic))\b/i,
  },
  {
    slot: "callback_number",
    re: /\b(call.?back|best (number|way to reach)|phone number|number to reach you|good number)\b/i,
  },
  {
    slot: "member_name",
    re: /\b(your (full )?name|name on (the|your) (account|policy|card)|who (am i|do i have).*speaking|spell.*name)\b/i,
  },
  {
    slot: "reason_for_call",
    re: /\b(reason|calling (about|regarding|in)|what.+regarding|nature of (the|your)|what can i help|how can i help|what did you need)\b/i,
  },
];

export interface SlotAnswer {
  slot: SlotName | null;
  answer: string | null;
}

/**
 * Work out which field a rep is asking for and return the value to read back.
 */
export function answerSlot(question: string, ctx: CaseContext): SlotAnswer {
  for (const m of SLOT_MATCHERS) {
    if (m.re.test(question)) {
      return { slot: m.slot, answer: ctx[m.slot] };
    }
  }
  return { slot: null, answer: null };
}

const SLOT_PHRASING: Record<SlotName, (v: string) => string> = {
  member_id: (v) => `Sure — the member ID is ${v}.`,
  member_name: (v) => `It's ${v}.`,
  date_of_birth: (v) => `Date of birth is ${v}.`,
  claim_number: (v) => `The claim number is ${v}.`,
  reason_for_call: (v) => `${v}`,
  callback_number: (v) => `Best callback number is ${v}.`,
  provider_name: (v) => `The provider is ${v}.`,
  date_of_service: (v) => `Date of service was ${v}.`,
};

/** Render a spoken answer for a slot the agent just filled. */
export function speakSlot(slot: SlotName, value: string | null): string {
  if (!value) return "Let me check on that and get right back to you.";
  return SLOT_PHRASING[slot](value);
}
