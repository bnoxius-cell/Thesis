import { useState } from "react";
import { Inbox, Users } from "lucide-react";
import { Button, ConfirmDialog, EmptyState, Field, Modal, ProgressBar, Segment, SelectButton, Skeleton } from "@/shared/ui";
import Section from "./Section";

const HOURS = [1, 2, 3, 4, 5, 6].map((h) => ({ value: h, label: `${h} ${h === 1 ? "hour" : "hours"}` }));
const PACES = ["Relaxed", "Balanced", "Intense"].map((p) => ({ value: p, label: p }));

// A dialog in the shape of Figma 53:909, with `extra` paragraphs to force the body to scroll.
function RhythmDialog({ onClose, extra = 0 }) {
  const [hours, setHours] = useState(3);
  const [pace, setPace] = useState("Balanced");
  return (
    <Modal
      as="form"
      title="Your rhythm"
      subtitle="These numbers shape your load and your sleep plan."
      onClose={onClose}
      confirmClose={() => hours !== 3 || pace !== "Balanced"}
      onSubmit={(e) => {
        e.preventDefault();
        onClose();
      }}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </>
      }
    >
      <Field label="Study hours a day">
        {(control) => <SelectButton {...control} block options={HOURS} value={hours} onChange={setHours} />}
      </Field>
      <Field label="Pace">{(control) => <Segment {...control} options={PACES} value={pace} onChange={setPace} />}</Field>
      <Field label="A text field" placeholder="Focus lands here first" />
      {Array.from({ length: extra }, (_, i) => (
        <p key={i}>Extra paragraph {i + 1}. The body scrolls inside the card while the title row and the buttons stay in view.</p>
      ))}
    </Modal>
  );
}

// EmptyState, Skeleton, ProgressBar, Modal and ConfirmDialog.
export default function SpecimenFeedback() {
  const [progress, setProgress] = useState(0.4);
  const [dialog, setDialog] = useState(null);
  const close = () => setDialog(null);

  return (
    <>
      <Section title="EmptyState">
        <EmptyState icon={Inbox} title="Nothing here yet" actions={<Button size="sm">Add one</Button>}>
          Notes you add will show up in this list.
        </EmptyState>
        <EmptyState page icon={Users} title="No groups yet" actions={<Button>New group</Button>}>
          Make a group for your class, or join one with a code.
        </EmptyState>
      </Section>

      <Section title="Skeleton">
        <div className="specimen-stack">
          <Skeleton height="20px" width="60%" />
          <Skeleton height="14px" />
          <Skeleton height="14px" width="80%" />
          <Skeleton circle width="44px" height="44px" />
        </div>
      </Section>

      <Section title="ProgressBar">
        <div className="specimen-stack">
          <ProgressBar value={progress} label="Question progress" valueText={`Question ${Math.round(progress * 10)} of 10`} />
          <ProgressBar value={0.75} tone="good" label="Learning Mode" />
          <div className="specimen-row">
            <Button size="sm" variant="secondary" onClick={() => setProgress((p) => Math.max(0, p - 0.1))}>Less</Button>
            <Button size="sm" variant="secondary" onClick={() => setProgress((p) => Math.min(1, p + 0.1))}>More</Button>
          </div>
        </div>
      </Section>

      <Section title="Modal, ConfirmDialog">
        <Button variant="secondary" onClick={() => setDialog("rhythm")}>Your rhythm dialog</Button>
        <Button variant="secondary" onClick={() => setDialog("long")}>Long content</Button>
        <Button variant="secondary" onClick={() => setDialog("confirm")}>Confirm</Button>
        <Button variant="secondary" onClick={() => setDialog("danger")}>Confirm (delete)</Button>
      </Section>

      {(dialog === "rhythm" || dialog === "long") && <RhythmDialog onClose={close} extra={dialog === "long" ? 14 : 0} />}
      <ConfirmDialog open={dialog === "confirm"} title="Send the check-in?" confirmLabel="Send" onConfirm={close} onCancel={close}>
        You can retake it any time.
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "danger"}
        title="Delete this reviewer?"
        confirmLabel="Delete"
        tone="danger"
        onConfirm={close}
        onCancel={close}
      >
        <strong>Databases notes</strong> and its practice history will be removed.
      </ConfirmDialog>
    </>
  );
}
