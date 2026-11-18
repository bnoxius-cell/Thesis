import { useId } from "react";
import "./class-choice.css";

const count = (n) => `${n} ${n === 1 ? "member uses" : "members use"} their own time for this class.`;

function Option({ name, value, checked, onChange, title, hint, extra }) {
  return (
    <label className={`entry-scope__option ${checked ? "is-checked" : ""}`.trim()}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="entry-scope__input" />
      <span className="entry-scope__dot" aria-hidden="true" />
      <span className="entry-scope__text">
        <span className="entry-scope__title">{title}</span>
        <span className="entry-scope__hint">{hint}</span>
        {extra && <span className="entry-scope__extra">{extra}</span>}
      </span>
    </label>
  );
}

// "Who is this for?" in the edit dialog of a class on a shared timetable (Figma GW-8: admin 385:4231, viewer
// 385:4619, phone 385:5491). "Just for me" saves the student's own copy and leaves the shared class alone;
// "For everyone in ..." changes the shared class for the whole timetable and says, as a count, how many
// members use their own time for it (never who). Someone who may not change the shared class sees only the
// first option and a line saying so.
//   value      "me" | "everyone"
//   shared     { name, group, ownTimeCount }: what the timetable is called (a group's name), whether it is a group's,
//              and how many members use their own time for this class
//   canPublish false when the student can't change the shared class
export default function EntryScopeChoice({ value, onChange, shared, canPublish }) {
  const name = useId();
  const unit = shared.group ? "group" : "timetable";
  return (
    <fieldset className="entry-scope">
      <legend className="entry-scope__legend">Who is this for?</legend>
      <Option
        name={name}
        value="me"
        checked={value === "me"}
        onChange={onChange}
        title="Just for me"
        hint={`Makes your own copy of this class. Everyone else keeps the ${unit}'s time.`}
      />
      {canPublish ? (
        <Option
          name={name}
          value="everyone"
          checked={value === "everyone"}
          onChange={onChange}
          title={`For everyone in ${shared.name}`}
          hint={`Changes it for the whole ${unit}.`}
          extra={shared.ownTimeCount > 0 && count(shared.ownTimeCount)}
        />
      ) : (
        <p className="entry-scope__locked">
          {shared.group ? "Only admins can change it for everyone." : "Only the people who edit this timetable can change it for everyone."}
        </p>
      )}
    </fieldset>
  );
}
