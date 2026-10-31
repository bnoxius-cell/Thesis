import { useState } from "react";
import { Button, Card, Chip } from "@/shared/ui";
import RhythmDialog from "./RhythmDialog";
import { rhythmChips } from "./rhythmChips";

// Your rhythm (Figma 51:2, 52:117, 53:734): what the plan assumes about the student's week, with Edit
// opening the rhythm dialog. `user` is the account, which holds the wake time the chips don't show.
export default function RhythmCard({ profile, user }) {
  const [editing, setEditing] = useState(false);

  return (
    <Card as="section" className="wellbeing-rhythm" aria-labelledby="wellbeing-rhythm">
      <div className="wellbeing-rhythm__head">
        <h2 id="wellbeing-rhythm" className="wellbeing-section-title">Your rhythm</h2>
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)} aria-haspopup="dialog">Edit</Button>
      </div>
      <ul className="wellbeing-rhythm__chips">
        {rhythmChips(profile).map((text) => (
          <li key={text}><Chip tone="neutral">{text}</Chip></li>
        ))}
      </ul>
      {editing && <RhythmDialog user={user} onClose={() => setEditing(false)} />}
    </Card>
  );
}
