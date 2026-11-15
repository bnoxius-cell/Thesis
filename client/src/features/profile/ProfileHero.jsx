import { Pencil } from "lucide-react";
import { Avatar, Button, Chip } from "@/shared/ui";
import { memberSince } from "./profileText";

const STATS = [
  { key: "friends", label: "Friends" },
  { key: "groups", label: "Groups" },
  { key: "reviewers", label: "Reviewers" },
  { key: "flashcards", label: "Flashcards" },
];

// The top card of Profile (Figma 290:16329, phone 292:2586): a cover band, the picture with its
// pencil badge, who the student is, the stats strip and the private email. The picture, the badge
// and Edit profile all open Edit profile; Preview shows the page other students see. Phones have
// room for one button beside the picture, so Preview moves under the bio there.
// Another student's page (Figma 326:2598) is the same card read-only: pass `actions` (their friend
// action) instead of `onEdit`. The picture is plain, there is no Edit, Preview or email, and a
// stat without a number is left out.
// `counts` maps friends / groups / reviewers / flashcards to a number, or null while unknown ("-").
export default function ProfileHero({ user, counts, onEdit, actions }) {
  const readOnly = !onEdit;
  const name = user.name || "Student";
  const since = memberSince(user.createdAt);
  const preview = `/people/${user._id}`;
  const stats = readOnly ? STATS.filter(({ key }) => counts[key] != null) : STATS;
  const picture = <Avatar name={name} src={user.avatar} size="hero" className="profile-hero__avatar" />;

  return (
    <section className={`profile-hero${readOnly ? " profile-hero--person" : ""}`} aria-labelledby="profile-name">
      <div className="profile-hero__cover">
        <div className="profile-hero__band" aria-hidden="true" />
        {readOnly ? (
          <div className="profile-hero__photo">{picture}</div>
        ) : (
          <>
            <button type="button" className="profile-hero__photo" onClick={onEdit} aria-label="Edit profile photo">
              {picture}
              <span className="profile-hero__badge" aria-hidden="true">
                <Pencil size={20} />
              </span>
            </button>
            <div className="profile-hero__actions">
              <Button variant="secondary" onClick={onEdit}>Edit profile</Button>
              <Button variant="ghost" to={preview} className="profile-hero__preview">Preview</Button>
            </div>
          </>
        )}
      </div>
      {readOnly && actions && <div className="profile-hero__actions profile-hero__actions--person">{actions}</div>}

      <div className="profile-hero__identity">
        <h2 id="profile-name" className="profile-hero__name">{name}</h2>
        {user.program && <p className="profile-hero__program">{user.program}</p>}
        {since && <Chip className="profile-hero__since">Member since {since}</Chip>}
        <p className={`profile-hero__bio${user.bio ? "" : " is-empty"}`}>{user.bio || "No bio yet."}</p>
        {!readOnly && <Button variant="ghost" to={preview} className="profile-hero__see">See how others see you</Button>}
      </div>

      {stats.length > 0 && (
        <ul className="profile-stats" aria-label={readOnly ? "Their numbers" : "Your numbers"}>
          {stats.map(({ key, label }) => (
            <li key={key} className="profile-stats__item">
              <span className="profile-stats__num">{counts[key] ?? "-"}</span>
              <span className="profile-stats__label">{label}</span>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="profile-hero__private">
          <p className="profile-hero__private-label">Email</p>
          <p className="profile-hero__private-text">{user.email}. Only you see this.</p>
        </div>
      )}
    </section>
  );
}
