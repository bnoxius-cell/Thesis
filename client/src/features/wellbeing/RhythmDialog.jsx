import { useState } from "react";
import { Button, Field, Modal, Segment, SelectButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import useSaveRhythm from "./useSaveRhythm";
import { PACE_OPTIONS, rhythmChanged, rhythmForm, rhythmOptions } from "./rhythm";
import "./rhythm-dialog.css";

// Your rhythm dialog (Figma 53:909): study hours and pace, which the load reads. Sleep and travel are
// edited on the Tonight card, and this form leaves them alone. Nothing is saved until Save; Cancel drops
// the edits, and closing with edits asks first (Modal's leave prompt).
export default function RhythmDialog({ user, onClose }) {
  const [start] = useState(() => rhythmForm(user));
  const [form, setForm] = useState(start);
  const { save, saving, error } = useSaveRhythm();
  const phone = useMediaQuery("(max-width: 480px)");
  const options = rhythmOptions(form);
  const changed = rhythmChanged(start, form);
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!changed) return onClose();
    if (await save(form)) onClose();
  };

  return (
    <Modal
      as="form"
      onSubmit={submit}
      className="rhythm-dialog"
      title="Your rhythm"
      subtitle="These numbers shape your load."
      busy={saving}
      onClose={onClose}
      confirmClose={() => changed}
      actions={(close) => (
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
          <Button type="submit" busy={saving}>{saving ? "Saving" : "Save"}</Button>
        </>
      )}
    >
      <Field label="Study hours a day">
        {(control) => (
          <SelectButton
            block
            native={phone}
            options={options.study}
            value={form.studyHoursPerDay}
            onChange={set("studyHoursPerDay")}
            label="Study hours a day"
            {...control}
          />
        )}
      </Field>
      <Field label="Pace">
        {({ labelId }) => (
          <Segment labelId={labelId} options={PACE_OPTIONS} value={form.wellbeingGoal} onChange={set("wellbeingGoal")} />
        )}
      </Field>
      {error && <p className="rhythm-dialog__error" role="alert">{error}</p>}
    </Modal>
  );
}
