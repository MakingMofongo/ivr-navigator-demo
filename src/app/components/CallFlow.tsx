import { Station } from "@/lib/view";

interface Props {
  stations: Station[];
  lastRevealedId: number;
}

const ICONS: Record<Station["kind"], string> = {
  menu: "#",
  hold: "⏸",
  human: "☎",
  bridge: "⇄",
};

export default function CallFlow({ stations, lastRevealedId }: Props) {
  if (stations.length === 0) {
    return (
      <div className="flow-empty">
        The agent&apos;s path through the phone tree will trace here as the call
        runs.
      </div>
    );
  }

  // Index of the most-recently-activated station.
  let activeIdx = -1;
  stations.forEach((s, i) => {
    if (s.revealAt <= lastRevealedId) activeIdx = i;
  });

  return (
    <ol className="flow">
      {stations.map((s, i) => {
        const reached = s.revealAt <= lastRevealedId;
        const isCurrent = i === activeIdx;
        const cls = [
          "flow-step",
          `flow-${s.kind}`,
          reached ? "reached" : "pending",
          isCurrent ? "current" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <li key={s.key} className={cls}>
            <span className="flow-node">{ICONS[s.kind]}</span>
            <span className="flow-body">
              <span className="flow-label">{s.label}</span>
              <span className="flow-sub">{s.sub}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
