import { describe, it, expect } from "vitest";
import { detect } from "./detector";

describe("detector — menu vs hold vs live human", () => {
  const menus = [
    "Thank you for calling Meridian Health. For claims, press 1. For member services, press 2.",
    "To check the status of an existing claim, press 1. To submit a new claim, press 2.",
    "Please listen carefully as our menu options have recently changed.",
    "Para español, oprima nueve. Using your touch-tone keypad, please enter your member ID.",
  ];

  const holds = [
    "All of our representatives are currently assisting other members. Please stay on the line.",
    "We are currently experiencing higher than normal call volume. Please continue to hold.",
    "Thank you for your patience. Your estimated wait time is approximately four minutes.",
    "You are caller number two in the queue. Please remain on the line.",
  ];

  const humans = [
    "Thanks for calling Meridian Health, this is Carla speaking — who do I have the pleasure of helping today?",
    "Hi there, my name is Andre with BlueStar authorizations, how can I help you today?",
    "No problem, I can pull that up. Can I get your member ID please?",
    "Thanks for holding, you're speaking with Renee at Allied claims — what can I help you with?",
    "Sure thing, give me one second while I pull that up.",
  ];

  it("labels menu prompts as menu", () => {
    for (const m of menus) {
      const r = detect(m);
      expect(r.label, `failed on: ${m}`).toBe("menu");
      expect(r.confidence).toBeGreaterThan(0.5);
    }
  });

  it("labels hold prompts as hold", () => {
    for (const h of holds) {
      const r = detect(h);
      expect(r.label, `failed on: ${h}`).toBe("hold");
      expect(r.confidence).toBeGreaterThan(0.5);
    }
  });

  it("labels live-rep speech as human", () => {
    for (const h of humans) {
      const r = detect(h);
      expect(r.label, `failed on: ${h}`).toBe("human");
      expect(r.confidence).toBeGreaterThan(0.5);
    }
  });

  it("does not confuse a menu prompt for a human", () => {
    const r = detect(
      "Thank you for calling. For billing, press 4. To repeat this menu, press 9.",
    );
    expect(r.label).toBe("menu");
    expect(r.scores.human).toBeLessThan(r.scores.menu);
  });

  it("treats hold music / silence as silence", () => {
    expect(detect("[hold music]").label).toBe("silence");
    expect(detect("   ").label).toBe("silence");
  });

  it("exposes the features that drove the decision", () => {
    const r = detect("my name is Carla, how can I help you today?");
    expect(r.topFeatures.length).toBeGreaterThan(0);
    expect(r.topFeatures[0].matched.length).toBeGreaterThan(0);
    expect(r.topFeatures.some((f) => f.label === "human")).toBe(true);
  });
});
