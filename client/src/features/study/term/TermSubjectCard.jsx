import { Plus } from "lucide-react";
import { Button, Card, Field } from "@/shared/ui";
import { SUBJECT_LIMITS } from "../subjectForm";
import ClassTimeRow from "./ClassTimeRow";
import { MAX_CLASS_TIMES } from "./newTermForm";

// One subject of the new term (TR-3): its name and code, then its class times. `errors` is { name?, times }
// for this subject and `notes` the clash warnings by class time key.
export default function TermSubjectCard({ subject, errors, notes, onChange, onRemove, onAddTime, onChangeTime, onRemoveTime }) {
  return (
    <Card className={`term-subject${subject.fresh ? " is-entering" : ""}`}>
      <div className="term-subject__top">
        <Field
          label="Subject name"
          value={subject.name}
          error={errors?.name}
          maxLength={SUBJECT_LIMITS.name}
          placeholder="e.g. Cloud Computing"
          autoComplete="off"
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <Field
          label="Code (optional)"
          className="term-subject__code"
          value={subject.code}
          maxLength={SUBJECT_LIMITS.code}
          autoComplete="off"
          onChange={(e) => onChange({ code: e.target.value })}
        />
      </div>
      <h3 className="term-subject__label">Class times</h3>
      {subject.classTimes.map((time, index) => (
        <ClassTimeRow
          key={time.key}
          time={time}
          position={index + 1}
          error={errors?.times[time.key]}
          note={notes[time.key]}
          onChange={(fields) => onChangeTime(time.key, fields)}
          onRemove={() => onRemoveTime(time.key)}
        />
      ))}
      <div className="term-subject__foot">
        <Button variant="ghost" icon={Plus} disabled={subject.classTimes.length >= MAX_CLASS_TIMES} onClick={onAddTime}>Add class time</Button>
        <button type="button" className="term-quiet" onClick={onRemove}>Remove subject</button>
      </div>
    </Card>
  );
}
