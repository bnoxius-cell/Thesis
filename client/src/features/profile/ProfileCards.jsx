import { useId } from "react";
import { Link } from "react-router-dom";
import { Avatar, Button } from "@/shared/ui";
import { rhythmRows } from "./profileText";

function CardHead({ id, title, to, seeAll }) {
  return (
    <div className="profile-card__head">
      <h2 id={id} className="profile-card__title">{title}</h2>
      <Button variant="ghost" to={to} aria-label={seeAll}>See all</Button>
    </div>
  );
}

// Your rhythm (Figma 295:2225): study hours, sleep goal and pace, read from the account. They are
// changed on Wellbeing, so See all goes there.
export function RhythmCard({ user }) {
  const id = useId();
  return (
    <section className="profile-card" aria-labelledby={id}>
      <CardHead id={id} title="Your rhythm" to="/wellbeing" seeAll="See all of your rhythm on Wellbeing" />
      <dl className="profile-card__rows">
        {rhythmRows(user).map(({ label, value }) => (
          <div key={label} className="profile-card__row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Your groups (Figma 295:2242): up to three, each opening its chat. `groups` is null until loaded.
export function GroupsCard({ groups }) {
  const id = useId();
  const shown = (groups ?? []).slice(0, 3);
  return (
    <section className="profile-card" aria-labelledby={id}>
      <CardHead id={id} title="Your groups" to="/people" seeAll="See all of your groups" />
      {groups === null && <p className="profile-card__note">Loading your groups...</p>}
      {groups?.length === 0 && <p className="profile-card__note">You're not in a group yet.</p>}
      {shown.length > 0 && (
        <ul className="profile-card__list">
          {shown.map((group) => (
            <li key={group._id}>
              <Link to={`/people/groups/${group._id}`} className="profile-group">
                <Avatar name={group.name} src={group.icon} size="row" />
                <span className="profile-group__text">
                  <span className="profile-group__name">{group.name}</span>
                  <span className="profile-group__meta">
                    {group.members.length} {group.members.length === 1 ? "member" : "members"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
