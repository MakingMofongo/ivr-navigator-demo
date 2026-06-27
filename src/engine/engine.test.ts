import { describe, it, expect } from "vitest";
import { runCall } from "./engine";
import { SCENARIOS } from "./scenarios";

describe("engine — full call end to end", () => {
  it("every scenario navigates the IVR, survives the hold, detects a live rep, and bridges", () => {
    for (const sc of SCENARIOS) {
      const { events, summary } = runCall(sc);

      // Reached the goal.
      expect(summary.bridged, `${sc.id} did not bridge`).toBe(true);
      expect(summary.liveRepDetected, `${sc.id} missed the live rep`).toBe(true);

      // Navigated a real menu tree and sat through at least one hold.
      expect(summary.menuHops).toBeGreaterThanOrEqual(4);
      expect(summary.holdEvents).toBeGreaterThanOrEqual(1);

      // Verified identity with the rep.
      expect(summary.slotsVerified.length).toBeGreaterThanOrEqual(2);

      // Event stream is well-formed and time-ordered.
      let lastT = -1;
      for (const e of events) {
        expect(e.t).toBeGreaterThanOrEqual(lastT);
        lastT = e.t;
      }

      // The decisive "LIVE HUMAN DETECTED" event exists.
      expect(
        events.some(
          (e) => e.type === "detection" && /LIVE HUMAN DETECTED/.test(e.text),
        ),
        `${sc.id} never emitted LIVE HUMAN DETECTED`,
      ).toBe(true);

      // A desktop notification fires on bridge.
      expect(events.some((e) => e.type === "notify")).toBe(true);

      // Ends in a completed call.
      const last = events[events.length - 1];
      expect(last.state).toBe("completed");
    }
  });

  it("does not hang up during BlueStar's two-stage hold", () => {
    const sc = SCENARIOS.find((s) => s.id === "bluestar-priorauth")!;
    const { summary } = runCall(sc);
    // Two hold messages (high-volume bounce + the real queue) — agent rides
    // both out instead of treating the first as a dead end.
    expect(summary.holdEvents).toBe(2);
    expect(summary.bridged).toBe(true);
  });

  it("produces a deterministic event stream", () => {
    const a = runCall(SCENARIOS[0]).events;
    const b = runCall(SCENARIOS[0]).events;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
