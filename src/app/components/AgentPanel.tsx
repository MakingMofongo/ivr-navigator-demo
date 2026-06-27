import { Scenario, SlotName } from "@/engine/types";
import { Checklist } from "@/lib/view";

interface Props {
  scenario: Scenario;
  checklist: Checklist;
  verifiedSlots: SlotName[];
}

const STEPS: { key: keyof Checklist; label: string }[] = [
  { key: "dialed", label: "Dialed the line" },
  { key: "navigated", label: "Navigated the IVR" },
  { key: "recoveredHold", label: "Recovered from hold" },
  { key: "liveRep", label: "Live rep detected" },
  { key: "verified", label: "Identity verified" },
  { key: "bridged", label: "Bridged to staff" },
];

const CASE_FIELDS: { key: SlotName; label: string }[] = [
  { key: "member_name", label: "Member" },
  { key: "member_id", label: "Member ID" },
  { key: "date_of_birth", label: "DOB" },
  { key: "claim_number", label: "Claim #" },
  { key: "provider_name", label: "Provider" },
  { key: "callback_number", label: "Callback" },
];

export default function AgentPanel({
  scenario,
  checklist,
  verifiedSlots,
}: Props) {
  return (
    <div className="agent-panel">
      <div className="agent-section">
        <span className="panel-kicker">Mission</span>
        <ul className="checklist">
          {STEPS.map((step) => {
            const done = checklist[step.key] as boolean;
            return (
              <li key={step.key} className={done ? "done" : ""}>
                <span className="check-box">{done ? "✓" : ""}</span>
                <span className="check-label">{step.label}</span>
                {step.key === "navigated" && checklist.menuHops > 0 && (
                  <span className="check-count">{checklist.menuHops} hops</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="agent-section">
        <span className="panel-kicker">Case file the agent is working from</span>
        <dl className="case-file">
          {CASE_FIELDS.map((f) => {
            const used = verifiedSlots.includes(f.key);
            return (
              <div key={f.key} className={`case-row${used ? " used" : ""}`}>
                <dt>{f.label}</dt>
                <dd>
                  {scenario.caseContext[f.key]}
                  {used && <span className="case-flag">read to rep</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}
