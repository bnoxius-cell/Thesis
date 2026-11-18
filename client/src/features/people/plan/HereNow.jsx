import PeopleAvatar from "../PeopleAvatar";
import { hereLine } from "./groupTaskText";

const MAX_FACES = 4;

// Who else has this group's plan open right now (Figma GW-1 "Here now"): overlapping pictures and one line.
// `people` is [{ _id, name, avatar }]. The row is always there, so the plan doesn't jump when someone
// arrives or leaves; alone, it says so quietly.
export default function HereNow({ people }) {
  return (
    <p className="group-here">
      {people.length > 0 && (
        <span className="group-here__faces" aria-hidden="true">
          {people.slice(0, MAX_FACES).map((person) => (
            <PeopleAvatar key={person._id} name={person.name} src={person.avatar} className="group-here__face" />
          ))}
        </span>
      )}
      {people.length > 0 ? hereLine(people.map((person) => person.name)) : "Just you here right now"}
    </p>
  );
}
