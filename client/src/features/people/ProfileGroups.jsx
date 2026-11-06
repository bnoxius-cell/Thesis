import PersonRow from "./PersonRow";

// "Groups you share" (Figma 66:920): each opens that group's chat. The profile answer has the group
// names only, so there is no member count under them.
export default function ProfileGroups({ groups }) {
  return (
    <section className="people-profile__groups" aria-labelledby="people-profile-groups">
      <h2 id="people-profile-groups" className="people-profile__groups-title">
        Groups you share
        <span className="people-profile__groups-count" aria-hidden="true">{groups.length}</span>
        <span className="sr-only">, {groups.length}</span>
      </h2>
      <ul className="people-persons">
        {groups.map((group) => (
          <PersonRow key={group._id} to={`/people/groups/${group._id}`} name={group.name} />
        ))}
      </ul>
    </section>
  );
}
