const WIDTH = 140;
const HEIGHT = 44;
const PAD = 6;

// The last few scores as a small line (Figma 51:313), oldest on the left, the latest as the bigger dot.
// `rows` come newest first, as the server sends them; `max` is the top of the scale. Drawn only for
// two or more results, since one dot says nothing about a trend.
export default function HistoryLine({ rows, max }) {
  if (rows.length < 2) return null;
  const scores = [...rows].reverse().map((row) => row.score);
  const points = scores.map((score, i) => ({
    x: PAD + (i * (WIDTH - 2 * PAD)) / (scores.length - 1),
    y: HEIGHT - PAD - (Math.min(score, max) / max) * (HEIGHT - 2 * PAD),
  }));
  const last = points[points.length - 1];

  return (
    <div className="wellbeing-history">
      <svg
        className="wellbeing-history__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label={`Scores, oldest to latest: ${scores.join(", ")}`}
      >
        <polyline className="wellbeing-history__line" points={points.map((p) => `${p.x},${p.y}`).join(" ")} />
        {points.slice(0, -1).map((p) => <circle key={p.x} className="wellbeing-history__dot" cx={p.x} cy={p.y} r="3" />)}
        <circle className="wellbeing-history__dot" cx={last.x} cy={last.y} r="4.5" />
      </svg>
      <p className="wellbeing-history__label">Last {scores.length} check-ins</p>
    </div>
  );
}
