import { describe, it, expect } from "vitest";
import { chooseOption, answerSlot, speakSlot } from "./agent";
import { SCENARIOS } from "./scenarios";
import { MenuNode } from "./types";

describe("agent — menu navigation", () => {
  it("picks the goal-matching option at every menu in every scenario", () => {
    // Walk each scenario the way the agent would and assert it never wanders
    // into a wrong department before reaching a hold or a human.
    for (const sc of SCENARIOS) {
      let nodeId = sc.startNode;
      let hops = 0;
      const visitedMenus: string[] = [];
      while (hops < 20) {
        const node = sc.nodes[nodeId];
        if (!node) throw new Error(`dangling node ${nodeId} in ${sc.id}`);
        if (node.type !== "menu") break; // reached hold/human
        const decision = chooseOption(node, sc.goalIntents, sc.goal);
        visitedMenus.push(node.id);
        // The chosen option must move us forward, not loop back to this menu.
        expect(
          decision.option.next,
          `${sc.id}/${node.id} looped on "${decision.option.label}"`,
        ).not.toBe(node.id);
        nodeId = decision.option.next;
        hops += 1;
      }
      // Each scenario should traverse at least 4 menus before a human/hold.
      expect(visitedMenus.length, `${sc.id} too few hops`).toBeGreaterThanOrEqual(4);
      // And must actually arrive at a hold or human node.
      expect(["hold", "human"]).toContain(sc.nodes[nodeId].type);
    }
  });

  it("chooses Claims (1) on the Meridian main menu", () => {
    const sc = SCENARIOS.find((s) => s.id === "meridian-health")!;
    const main = sc.nodes["main"] as MenuNode;
    const d = chooseOption(main, sc.goalIntents, sc.goal);
    expect(d.option.digit).toBe("1");
    expect(d.option.label).toBe("Claims");
  });

  it("chooses Authorizations (2) on the BlueStar main menu", () => {
    const sc = SCENARIOS.find((s) => s.id === "bluestar-priorauth")!;
    const main = sc.nodes["main"] as MenuNode;
    const d = chooseOption(main, sc.goalIntents, sc.goal);
    expect(d.option.digit).toBe("2");
  });

  it("returns a full ranking so the choice is explainable", () => {
    const sc = SCENARIOS.find((s) => s.id === "allied-auto")!;
    const main = sc.nodes["main"] as MenuNode;
    const d = chooseOption(main, sc.goalIntents, sc.goal);
    expect(d.ranked.length).toBe(main.options.length);
    expect(d.ranked[0].score).toBeGreaterThanOrEqual(d.ranked[1].score);
  });
});

describe("agent — slot filling", () => {
  const ctx = SCENARIOS[0].caseContext;

  const cases: [string, string][] = [
    ["Can I get your member ID please?", ctx.member_id],
    ["What's the date of birth on file?", ctx.date_of_birth],
    ["Could you provide the claim number?", ctx.claim_number],
    ["What's your full name on the policy?", ctx.member_name],
    ["What's the best callback number?", ctx.callback_number],
    ["Which provider is this for?", ctx.provider_name],
    ["What was the date of service?", ctx.date_of_service],
  ];

  it("maps each rep question to the right field", () => {
    for (const [q, expected] of cases) {
      const a = answerSlot(q, ctx);
      expect(a.answer, `failed on: ${q}`).toBe(expected);
    }
  });

  it("returns null for an unrelated question", () => {
    const a = answerSlot("Lovely weather we're having, isn't it?", ctx);
    expect(a.slot).toBeNull();
    expect(a.answer).toBeNull();
  });

  it("speaks a graceful line when it cannot answer", () => {
    expect(speakSlot("member_id", null)).toMatch(/check on that/i);
    expect(speakSlot("member_id", "MRD-1")).toContain("MRD-1");
  });
});
