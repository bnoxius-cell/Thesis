import { useState } from "react";
import { Button, Field, Modal, Segment, SelectButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import useSaveRhythm from "./useSaveRhythm";
import { PACE_OPTIONS, rhythmChanged, rhythmForm, rhythmOptions } from "./rhythm";
import "./rhythm-dialog.css";

// Your rhythm dialog (Figma 53:909): the numbers the load and the sleep plan read. Nothing is saved
// until Save; Cancel drops the edits, and closing with edits asks first (Modal's leave prompt).
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

  // Native pickers on phones: the long lists (times, travel) are far easier in the system sheet.
  const picker = (label, key, list) => (
    <Field label={label}>
      {(control) => (
        <SelectButton block native={phone} options={list} value={form[key]} onChange={set(key)} label={label} {...control} />
      )}
    </Field>
  );

  return (
    <Modal
      as="form"
      onSubmit={submit}
      className="rhythm-dialog"
      title="Your rhythm"
      subtitle="These numbers shape your load and your sleep plan."
      busy={saving}
      onClose={onClose}
      confirmClose={() => changed}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" busy={saving}>{saving ? "Saving" : "Save"}</Button>
        </>
      }
    >
      {picker("Study hours a day", "studyHoursPerDay", options.study)}
      {picker("Sleep target", "sleepHours", options.sleep)}
      <div className="rhythm-dialog__times">
        {picker("Usual bedtime", "usualSleepStart", options.times)}
        {picker("Usual wake time", "usualWakeTime", options.wakeTimes)}
      </div>
      {picker("Travel time to campus", "travelMinutesPerDay", options.travel)}
      <Field label="Pace">
        {({ labelId }) => (
          <Segment labelId={labelId} options={PACE_OPTIONS} value={form.wellbeingGoal} onChange={set("wellbeingGoal")} />
        )}
      </Field>
      {error && <p className="rhythm-dialog__error" role="alert">{error}</p>}
    </Modal>
  );
}
