import { DetectorResult, DetectorLabel } from "@/engine/types";

interface Props {
  detection: DetectorResult | null;
}

const LABEL_TEXT: Record<DetectorLabel, string> = {
  menu: "Automated menu",
  hold: "Hold queue",
  human: "Live human",
  silence: "Silence / hold music",
  unknown: "Listening…",
};

const BARS: { key: DetectorLabel; label: string }[] = [
  { key: "menu", label: "Menu" },
  { key: "hold", label: "Hold" },
  { key: "human", label: "Human" },
];

export default function DetectorPanel({ detection }: Props) {
  const label = detection?.label ?? "unknown";
  const conf = detection ? Math.round(detection.confidence * 100) : 0;

  const maxScore = detection
    ? Math.max(1, detection.scores.menu, detection.scores.hold, detection.scores.human)
    : 1;

  return (
    <div className={`detector detector-${label}`}>
      <div className="detector-head">
        <div className="detector-verdict">
          <span className="detector-kicker">Live-rep detector</span>
          <span className="detector-label">{LABEL_TEXT[label]}</span>
        </div>
        <div className="detector-conf">
          <span className="conf-num">{conf}</span>
          <span className="conf-pct">%</span>
        </div>
      </div>

      <div className="detector-bars">
        {BARS.map((b) => {
          const score = detection ? detection.scores[b.key] : 0;
          const w = Math.round((score / maxScore) * 100);
          return (
            <div className="bar-row" key={b.key}>
              <span className="bar-name">{b.label}</span>
              <span className="bar-track">
                <span
                  className={`bar-fill bar-${b.key}${label === b.key ? " bar-win" : ""}`}
                  style={{ width: `${w}%` }}
                />
              </span>
              <span className="bar-score">{score.toFixed(1)}</span>
            </div>
          );
        })}
      </div>

      <div className="detector-features">
        <span className="detector-kicker">Why</span>
        {detection && detection.topFeatures.length > 0 ? (
          <ul className="feature-list">
            {detection.topFeatures.map((f, i) => (
              <li key={i} className={`feature feature-${f.label}`}>
                <code>{f.name}</code>
                <span className="feature-weight">+{f.weight}</span>
                {f.matched[0] && (
                  <span className="feature-match">“{f.matched[0]}”</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">
            Cues from each transcript chunk show here — the phrases that drove the
            classification.
          </p>
        )}
      </div>
    </div>
  );
}
