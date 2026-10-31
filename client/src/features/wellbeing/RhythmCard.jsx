import { Card, Chip } from "@/shared/ui";
import { rhythmChips } from "./rhythmChips";

// Your rhythm (Figma 51:2, 52:117): what the plan assumes about the student's week. The Edit button
// comes with the rhythm dialog (W3).
export default function RhythmCard({ profile }) {
  return (
    <Card as="section" className="wellbeing-rhythm" aria-labelledby="wellbeing-rhythm">
      <h2 id="wellbeing-rhythm" className="wellbeing-section-title">Your rhythm</h2>
      <ul className="wellbeing-rhythm__chips">
        {rhythmChips(profile).map((text) => (
          <li key={text}><Chip tone="neutral">{text}</Chip></li>
        ))}
      </ul>
    </Card>
  );
}
