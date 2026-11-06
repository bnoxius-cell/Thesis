import PeopleAvatar from "./PeopleAvatar";
import ProfileActions from "./ProfileActions";
import "./people-shared.css";

// The profile card (Figma 66:905): picture, name, program and the one action on top, then About.
// The profile carries no study year, so the line under the name is the program alone. Email and
// check-in results are never part of a profile, and the card says so.
export default function ProfileCard({ person, isSelf, actions }) {
  return (
    <section className="people-profile__card" aria-labelledby="people-profile-name">
      <div className="people-profile__top">
        <PeopleAvatar name={person.name} src={person.avatar} className="people-profile__avatar" />
        <div className="people-profile__who">
          <h2 id="people-profile-name" className="people-profile__name">{person.name}</h2>
          {person.program && <p className="people-profile__program">{person.program}</p>}
        </div>
        {!isSelf && (
          <div className="people-profile__actions">
            <ProfileActions person={person} {...actions} />
          </div>
        )}
      </div>
      <hr className="people-profile__rule" />
      <div className="people-profile__about">
        <p className="people-eyebrow">About</p>
        <p className={`people-profile__bio${person.bio ? "" : " is-empty"}`}>{person.bio || "No bio yet."}</p>
      </div>
      <p className="people-profile__note">Email and check-in results are never shown on profiles.</p>
    </section>
  );
}
