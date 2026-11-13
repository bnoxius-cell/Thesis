import { useMemo, useState } from "react";
import { TriangleAlert, Users } from "lucide-react";
import { Button, Field, Modal, Segment, SelectButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import { KIND_LABELS, WEEKDAYS } from "@/utils/scheduleUtils";
import {
  ENTRY_LINK_MAX,
  ENTRY_NOTES_MAX,
  ENTRY_ROOM_MAX,
  ENTRY_TITLE_MAX,
  PREP_HOURS_MAX,
  REPEAT,
  clashNote,
  emptyEntryForm,
  entryErrors,
  entryPayload,
  entryStarted,
  linkError,
  titleAfterSubject,
} from "@/utils/entryForm";
import useEntryTarget from "./useEntryTarget";
import useSaveEntry from "./useSaveEntry";
import "./entry-form.css";

const KINDS = ["class", "exam", "event", "activity"].map((value) => ({ value, label: KIND_LABELS[value] }));
const REPEATS = [
  { value: REPEAT.once, label: "One day" },
  { value: REPEAT.weekly, label: "Weekly" },
];
const NO_SUBJECT = "";

// New class, exam, event or activity (Figma D4: desktop 209:2364, 209:2681, 209:2980, phone sheets 210:2576,
// 210:2673, 210:2753). `kind` is the one the "+" menu chose; the Type segment can change it. `subjects` is the
// list the page loaded: picking one fills the Title with its name (the timetable matches by title). `timetable`
// is the picked timetable the student can edit, or null for My week (the main timetable, created when missing).
// Nothing is saved until the button; closing asks first when something was typed. A failed save keeps the
// dialog open with the message. `onSaved` gets the timetable after the change, the kind saved and the entry's fields (its date or days). The clash note only warns.
export default function EntryFormDialog({ kind, subjects, timetable = null, onClose, onSaved }) {
  const [start] = useState(() => emptyEntryForm(kind));
  const [form, setForm] = useState(start);
  const [errors, setErrors] = useState({});
  const { save, saving, error } = useSaveEntry();
  const target = useEntryTarget(timetable);
  const phone = useMediaQuery("(max-width: 480px)");

  const exam = form.kind === "exam";
  const weekly = form.repeat === REPEAT.weekly && !exam;
  const label = KIND_LABELS[form.kind].toLowerCase();
  const note = useMemo(() => clashNote(form, target?.entries), [form, target]);
  const subjectOptions = [
    { value: NO_SUBJECT, label: "No subject" },
    ...subjects.map((subject) => ({ value: subject.name, label: subject.name })),
  ];

  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    const times = key === "startTime" || key === "endTime" ? { times: undefined } : {};
    setErrors((prev) => ({ ...prev, [key]: undefined, ...times }));
  };
  const onText = (key) => (event) => set(key)(event.target.value);
  const pickKind = (next) =>
    setForm((prev) => ({
      ...prev,
      kind: next,
      repeat: emptyEntryForm(next).repeat,
      subject: next === "class" || next === "exam" ? prev.subject : NO_SUBJECT,
    }));
  const pickSubject = (name) =>
    setForm((prev) => ({ ...prev, subject: name, title: titleAfterSubject(prev.title, prev.subject, name) }));
  const toggleDay = (day) => {
    setForm((prev) => ({ ...prev, days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day] }));
    setErrors((prev) => ({ ...prev, days: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = entryErrors(form);
    if (Object.keys(found).length > 0) return setErrors(found);
    const schedule = await save(form, timetable);
    if (schedule) onSaved(schedule, form.kind, entryPayload(form));
  };

  let subtitle = "Adds to your main timetable.";
  if (timetable) subtitle = `Adds to ${timetable.title}.`;
  else if (target) subtitle = `Adds to ${target.title}, your main timetable.`;
  else if (target === null) subtitle = "Adds to a new timetable called My timetable.";

  const subjectField = (
    <Field label="Subject (optional)">
      {(control) => (
        <SelectButton block native={phone} options={subjectOptions} value={form.subject} onChange={pickSubject} label="Subject" {...control} />
      )}
    </Field>
  );
  const titleField = (
    <Field
      label="Title"
      value={form.title}
      onChange={onText("title")}
      error={errors.title}
      maxLength={ENTRY_TITLE_MAX}
      placeholder={exam ? "e.g. Midterm: Web Systems" : "e.g. Data Mining"}
      autoComplete="off"
      required
    />
  );

  return (
    <Modal
      as="form"
      onSubmit={submit}
      noValidate
      sheet
      className="entry-dialog"
      title={`New ${label}`}
      subtitle={subtitle}
      busy={saving}
      onClose={onClose}
      confirmClose={() => entryStarted(form, start)}
      actions={(close) => (
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
          <Button type="submit" busy={saving}>{saving ? "Saving" : `Add ${label}`}</Button>
        </>
      )}
    >
      <Field label="Type">
        {({ labelId }) => <Segment labelId={labelId} options={KINDS} value={form.kind} onChange={pickKind} />}
      </Field>
      {form.kind === "class" || exam ? (
        <div className="entry-dialog__pair">
          {subjectField}
          {titleField}
        </div>
      ) : (
        titleField
      )}
      {form.kind === "event" && (
        <Field label="Happens">
          {({ labelId }) => <Segment labelId={labelId} options={REPEATS} value={form.repeat} onChange={set("repeat")} />}
        </Field>
      )}
      {weekly ? (
        <Field label="Repeats on" error={errors.days}>
          {({ labelId }) => (
            <div role="group" aria-labelledby={labelId} className="entry-dialog__days">
              {WEEKDAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  className="entry-dialog__day"
                  aria-pressed={form.days.includes(day.value)}
                  aria-label={day.long}
                  onClick={() => toggleDay(day.value)}
                >
                  {day.long[0]}
                </button>
              ))}
            </div>
          )}
        </Field>
      ) : (
        <Field label="Date" type="date" value={form.date} onChange={onText("date")} error={errors.date} required />
      )}
      <div className="entry-dialog__pair">
        <Field label="Starts" type="time" value={form.startTime} onChange={onText("startTime")} required />
        <Field label="Ends" type="time" value={form.endTime} onChange={onText("endTime")} error={errors.times} required />
      </div>
      {note && (
        <p className="entry-dialog__note" role="status">
          <TriangleAlert size={20} aria-hidden="true" />
          <span>{note}</span>
        </p>
      )}
      {exam && (
        <Field
          label="Study time before it (hours)"
          type="number"
          inputMode="decimal"
          min="0"
          max={PREP_HOURS_MAX}
          step="0.5"
          value={form.prepHours}
          onChange={onText("prepHours")}
          error={errors.prepHours}
        />
      )}
      <div className="entry-dialog__pair">
        <Field
          label="Room (optional)"
          value={form.location}
          onChange={onText("location")}
          maxLength={ENTRY_ROOM_MAX}
          autoComplete="off"
        />
        <Field
          label="Meeting link (optional)"
          value={form.meetingUrl}
          onChange={onText("meetingUrl")}
          onBlur={() => setErrors((prev) => ({ ...prev, meetingUrl: linkError(form.meetingUrl) || undefined }))}
          error={errors.meetingUrl}
          placeholder="Paste a Zoom or Meet link"
          maxLength={ENTRY_LINK_MAX}
          inputMode="url"
          autoCapitalize="none"
          autoComplete="off"
        />
      </div>
      <Field
        label="Notes (optional)"
        className="entry-dialog__notes"
        multiline
        value={form.notes}
        onChange={onText("notes")}
        placeholder="Anything to remember, like what to bring"
        maxLength={ENTRY_NOTES_MAX}
        hint={`${form.notes.length} / ${ENTRY_NOTES_MAX}`}
      />
      {timetable?.live && (
        <p className="entry-dialog__shared">
          <Users size={18} aria-hidden="true" />
          <span>Everyone on {timetable.title} sees this change.</span>
        </p>
      )}
      {error && <p className="entry-dialog__error" role="alert">{error}</p>}
    </Modal>
  );
}
