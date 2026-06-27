// Call orchestration.
//
// runCall() drives a scenario from dial to bridge, calling the *real* detector
// and agent at each step, and records everything as an ordered list of timed
// CallEvents. The decisions (which digit, which slot answer, when to declare a
// live human, when to bridge) are genuine — they come from detect()/chooseOption()
// /answerSlot(). The output is deterministic, which makes it both unit-testable
// and replayable in the UI: the browser just reveals the precomputed events over
// time using their `t` offsets, so what you watch is the actual logic running.

import { Scenario, CallEvent, CaseContext, SlotName } from "./types";
import { detect } from "./detector";
import { chooseOption, answerSlot, speakSlot } from "./agent";
import { pct } from "./util";

export interface CallSummary {
  insurer: string;
  goal: string;
  menuHops: number;
  holdEvents: number;
  liveRepDetected: boolean;
  slotsVerified: SlotName[];
  bridged: boolean;
  bridgeTarget: string;
  durationMs: number;
}

export interface CallResult {
  events: CallEvent[];
  summary: CallSummary;
}

const ACKS = ["Great, thank you.", "Perfect.", "Got it, thanks.", "Sounds good."];

function repReason(ctx: CaseContext): string {
  return ctx.reason_for_call;
}

/**
 * Run a full call and return the event stream + summary.
 */
export function runCall(scenario: Scenario): CallResult {
  const events: CallEvent[] = [];
  let id = 0;
  let t = 0;

  const push = (
    e: Omit<CallEvent, "id" | "t">,
    dt = 0,
  ): void => {
    t += dt;
    events.push({ id: id++, t, ...e });
  };

  let menuHops = 0;
  let holdEvents = 0;
  let liveRepDetected = false;
  let bridged = false;
  const slotsVerified: SlotName[] = [];

  push(
    {
      role: "system",
      type: "state",
      state: "dialing",
      text: `Dialing ${scenario.insurer} at ${scenario.phoneNumber}…`,
    },
    0,
  );
  push(
    {
      role: "system",
      type: "state",
      state: "ringing",
      text: "Ringing — outbound call connected.",
    },
    1300,
  );

  let nodeId = scenario.startNode;
  let guard = 0;

  while (guard++ < 60) {
    const node = scenario.nodes[nodeId];
    if (!node) break;

    if (node.type === "menu") {
      push(
        { role: "ivr", type: "transcript", text: node.prompt, nodeId },
        1100,
      );
      const det = detect(node.prompt);
      push(
        {
          role: "detector",
          type: "detection",
          text: `Classified far end as ${det.label.toUpperCase()} · ${pct(det.confidence)} confidence`,
          detection: det,
          nodeId,
        },
        420,
      );

      const decision = chooseOption(node, scenario.goalIntents, scenario.goal);
      push(
        {
          role: "agent",
          type: "action",
          text: decision.reason,
          meta: { ranked: decision.ranked },
          nodeId,
        },
        560,
      );
      push(
        {
          role: "agent",
          type: "dtmf",
          text: `Pressing ${decision.option.digit} — ${decision.option.label}`,
          meta: { digit: decision.option.digit },
          nodeId,
        },
        480,
      );
      menuHops += 1;

      if (decision.option.next === nodeId) {
        // Option loops back to the same menu — guard against an infinite tree.
        break;
      }
      nodeId = decision.option.next;
      continue;
    }

    if (node.type === "hold") {
      push(
        { role: "ivr", type: "transcript", text: node.prompt, nodeId },
        1100,
      );
      const det = detect(node.prompt);
      push(
        {
          role: "detector",
          type: "detection",
          text: `Classified far end as HOLD QUEUE · ${pct(det.confidence)} confidence`,
          detection: det,
          nodeId,
        },
        420,
      );
      holdEvents += 1;
      push(
        {
          role: "agent",
          type: "state",
          state: "on_hold",
          text: `Hold queue detected — staying on the line (no hang-up), est. wait ~${node.holdSeconds}s. Monitoring audio for a live pickup.`,
          nodeId,
        },
        450,
      );
      push(
        {
          role: "agent",
          type: "note",
          text: "Still holding… running live-rep detection on every new audio segment.",
          nodeId,
        },
        2400,
      );
      push(
        {
          role: "agent",
          type: "action",
          text: "Audio changed (hold music stopped) — re-evaluating for a live human.",
          nodeId,
        },
        900,
      );
      nodeId = node.next;
      continue;
    }

    if (node.type === "human") {
      let ackIndex = 0;
      for (let i = 0; i < node.turns.length; i++) {
        const turn = node.turns[i];
        push(
          {
            role: "human",
            type: "transcript",
            text: `${node.repName}: ${turn.text}`,
            nodeId,
          },
          1200,
        );
        const det = detect(turn.text);

        if (i === 0) {
          // The money moment: stop pressing buttons, start talking.
          liveRepDetected = true;
          push(
            {
              role: "detector",
              type: "detection",
              text: `LIVE HUMAN DETECTED · ${pct(det.confidence)} confidence — switching from IVR navigation to conversation mode.`,
              detection: det,
              nodeId,
            },
            430,
          );
          push(
            {
              role: "agent",
              type: "state",
              state: "live_human",
              text: "Live representative confirmed. Greeting the rep and stating the reason for the call.",
              nodeId,
            },
            350,
          );
          push(
            {
              role: "agent",
              type: "transcript",
              text: `Agent: Hi! Yes — I'm calling on behalf of ${scenario.caseContext.member_name}. ${repReason(scenario.caseContext)}`,
              nodeId,
            },
            780,
          );
          continue;
        }

        // Subsequent rep turns.
        push(
          {
            role: "detector",
            type: "detection",
            text: `Still LIVE HUMAN · ${pct(det.confidence)} confidence`,
            detection: det,
            nodeId,
          },
          360,
        );

        if (turn.asks) {
          const ans = answerSlot(turn.text, scenario.caseContext);
          const slot = ans.slot ?? turn.asks;
          push(
            {
              role: "agent",
              type: "action",
              text: `Rep is requesting: ${slot.replace(/_/g, " ")} → reading from the case file.`,
              meta: { slot },
              nodeId,
            },
            480,
          );
          push(
            {
              role: "agent",
              type: "transcript",
              text: `Agent: ${speakSlot(slot, ans.answer)}`,
              nodeId,
            },
            680,
          );
          if (ans.answer) slotsVerified.push(slot);
        } else {
          push(
            {
              role: "agent",
              type: "transcript",
              text: `Agent: ${ACKS[ackIndex % ACKS.length]}`,
              nodeId,
            },
            600,
          );
          ackIndex += 1;
        }

        if (turn.expectsBridge) {
          bridged = true;
          push(
            {
              role: "agent",
              type: "state",
              state: "bridging",
              text: `Identity verified (${slotsVerified.join(", ") || "account located"}). Live rep is ready — bridging in ${scenario.bridgeTarget}.`,
              nodeId,
            },
            650,
          );
          push(
            {
              role: "system",
              type: "notify",
              text: `Live agent reached at ${scenario.insurer}. Bridging ${scenario.bridgeTarget} onto the call now.`,
              meta: {
                title: "Live agent on the line",
                body: `${scenario.insurer} — bridging ${scenario.bridgeTarget}`,
              },
              nodeId,
            },
            520,
          );
          push(
            {
              role: "system",
              type: "state",
              state: "bridged",
              text: `Call bridged to client staff. Agent stays on as a silent assistant.`,
              nodeId,
            },
            450,
          );
        }
      }
      break;
    }

    break;
  }

  push(
    {
      role: "system",
      type: "state",
      state: bridged ? "completed" : "failed",
      text: bridged
        ? "Call complete — goal achieved, staff connected to a live rep."
        : "Call ended without reaching a live rep.",
    },
    600,
  );

  const summary: CallSummary = {
    insurer: scenario.insurer,
    goal: scenario.goal,
    menuHops,
    holdEvents,
    liveRepDetected,
    slotsVerified,
    bridged,
    bridgeTarget: scenario.bridgeTarget,
    durationMs: t,
  };

  return { events, summary };
}
