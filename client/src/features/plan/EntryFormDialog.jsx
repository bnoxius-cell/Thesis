import { useMemo, useState } from "react";
import { TriangleAlert, Users } from "lucide-react";
import { Button, Field, Modal, Segment, SelectButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import { EntryScopeChoice } from "@/features/plan/shared";
import newSubjectOption from "@/features/study/newSubjectOption";
import NewSubjectNameField from "@/features/study/NewSubjectNameField";
import { NEW_SUBJECT } from "@/features/study/subjectForm";
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
  entryFormFrom,
  entryPayload,
  entryStarted,
  linkError,
  subjectNameOf,
  titleAfterSubject,
} from "@/utils/entryForm";
import useEntryTarget from "./useEntryTarget";
import useSaveEntry from "./useSaveEntry";
import "./entry-form.css";

const REPEATS = [
  { value: REPEAT.once, label: "One day" },
  { value: REPEAT.weekly, label: "Weekly" },
];
const NO_SUBJECT = "";
const NEW_SUBJECT_OPTION = newSubjectOption("New subject...");

// New or edited class, exam, event or activity (Figma D4: desktop 209:2364, 209:2681, 209:2980, edit on a
// shared timetable 209:3273, phone sheets 210:2576, 210:2673, 210:2753, 210:2828). `kind` is the one the "+"
// menu chose and stays fixed. `subjects` is the list the page loaded: the picker's values are subject ids, and
// picking one fills the Title with its name (the server titles a class with its subject's name anyway).
// A group's timetable shows no Subject picker at all (the server stores none). Elsewhere the picker ends with
// "New subject..." when the student owns the timetable (the server ignores it from an editor): it shows a required Name field and the save sends `newSubject`, so the server makes the subject.
// `timetable` is the picked timetable the student can edit, or null for My week (the main timetable, created
// when missing). To edit, pass the stored `entry` and the `timetable` it lives on (always required then).
// Nothing is saved until the button; closing asks first when something was typed. A failed save keeps the
// dialog open with the message. `onSaved` gets the timetable after the change, the kind saved and the entry's
// fields (its date or days), and `{ mine: true }` after "just for me". `onGone` runs when an edited entry has been removed meanwhile. The clash note only warns.
// Editing a class of a timetable shared with the student (the entry carries `myChoice`) asks "Who is this for?"
// (Figma GW-8): "Just for me" saves their own copy and leaves the shared class alone, "For everyone" changes it
// as before (and says how many members use their own time for it). Someone who can't change the shared class
// is only offered the first.
export default function EntryFormDialog({ kind, subjects, timetable = null, entry = null, onClose, onSaved, onGone }) {
  const editing = Boolean(entry);
  const [start] = useState(() => (entry ? entryFormFrom(entry) : emptyEntryForm(kind)));
  const [form, setForm] = useState(start);
  const [errors, setErrors] = useState({});
  const { save, saveMine, saving, error } = useSaveEntry();
  const sharedClass = editing && Boolean(entry.myChoice); // a class the student may make their own copy of
  const canPublish = timetable?.role !== "viewer";
  const [scope, setScope] = useState(canPublish ? "everyone" : "me");
  const mine = sharedClass && scope === "me";
  const target = useEntryTarget(timetable);
  const phone = useMediaQuery("(max-width: 480px)");

  const exam = form.kind === "exam";
  const ownsTimetable = !timetable || timetable.role === "owner";
  const inGroup = Boolean(timetable?.group); // a group's classes carry no subject: each member's is matched by name
  const creatingSubject = form.subject === NEW_SUBJECT;
  const weekly = form.repeat === REPEAT.weekly && !exam;
  const label = KIND_LABELS[form.kind].toLowerCase();
  const note = useMemo(
    () => clashNote(form, target?.entries.filter((other) => other._id !== entry?._id)),
    [form, target, entry],
  );
  const subjectOptions = [
    { value: NO_SUBJECT, label: "No subject" },
    ...subjects.map((subject) => ({ value: subject._id, label: subject.name })),
    ...(ownsTimetable ? [NEW_SUBJECT_OPTION] : []),
  ];

  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    const times = key === "startTime" || key === "endTime" ? { times: undefined } : {};
    setErrors((prev) => ({ ...prev, [key]: undefined, ...times }));
  };
  const onText = (key) => (event) => set(key)(event.target.value);
  // The Title follows the picked subject's name, or the name typed for a new one, until the student edits it.
  const changeSubject = (change) =>
    setForm((prev) => {
      const next = { ...prev, ...change };
      return { ...next, title: titleAfterSubject(prev.title, subjectNameOf(prev, subjects), subjectNameOf(next, subjects) || prev.title) };
    });
  const pickSubject = (id) => {
    changeSubject({ subject: id });
    setErrors((prev) => ({ ...prev, newSubject: undefined }));
  };
  const typeNewSubject = (event) => {
    changeSubject({ newSubjectName: event.target.value });
    setErrors((prev) => ({ ...prev, newSubject: undefined }));
  };
  const toggleDay = (day) => {
    setForm((prev) => ({ ...prev, days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day] }));
    setErrors((prev) => ({ ...prev, days: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = entryErrors(form);
    if (Object.keys(found).length > 0) return setErrors(found);
    const { schedule, gone } = await (mine ? saveMine(form, timetable, entry) : save(form, timetable, entry));
    if (gone) onGone();
    else if (schedule) onSaved(schedule, form.kind, entryPayload(form), { mine });
  };

  let subtitle = "Adds to your main timetable.";
  if (editing) subtitle = `On ${timetable.title}.`;
  else if (timetable) subtitle = `Adds to ${timetable.title}.`;
  else if (target) subtitle = `Adds to ${target.title}, your main timetable.`;
  else if (target === null) subtitle = "Adds to a new timetable called My timetable.";

  let saveLabel = `Add ${label}`;
  if (mine) saveLabel = "Save my copy";
  else if (editing) saveLabel = "Save changes";

  const subjectField = (
    <Field label="Subject (optional)">
      {(control) => (
        <SelectButton block native={phone} options={subjectOptions} value={form.subject} onChange={pickSubject} label="Subject" {...control} />
      )}
    </Field>
  );
  const newSubjectField = creatingSubject && (
    <NewSubjectNameField value={form.newSubjectName} onChange={typeNewSubject} error={errors.newSubject} />
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
      title={`${editing ? "Edit" : "New"} ${label}`}
      subtitle={subtitle}
      busy={saving}
      onClose={onClose}
      confirmClose={() => entryStarted(form, start)}
      actions={(close) => (
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
          <Button type="submit" busy={saving}>{saving ? "Saving" : saveLabel}</Button>
        </>
      )}
    >
      {(form.kind === "class" || exam) && !inGroup ? (
        <>
          <div className="entry-dialog__pair">
            {subjectField}
            {titleField}
          </div>
          {newSubjectField}
        </>
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
      {sharedClass && (
        <EntryScopeChoice
          value={scope}
          onChange={setScope}
          canPublish={canPublish}
          shared={{ name: timetable.group?.name ?? timetable.title, group: Boolean(timetable.group), ownTimeCount: entry.ownTimeCount ?? 0 }}
        />
      )}
      {timetable?.live && !sharedClass && (
        <p className="entry-dialog__shared">
          <Users size={18} aria-hidden="true" />
          <span>Everyone on {timetable.title} sees this change.</span>
        </p>
      )}
      {error && <p className="entry-dialog__error" role="alert">{error}</p>}
    </Modal>
  );
}
