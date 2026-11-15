import { useLocation, useNavigate, useParams } from "react-router-dom";
import { UserRound } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui";
import Page from "@/app/shell/Page";
import ProfileHero from "@/features/profile/ProfileHero";
import { SharedGroupsCard } from "@/features/profile/ProfileCards";
import "@/features/profile/profile.css";
import ProfileActions from "./ProfileActions";
import useStudentProfile from "./useStudentProfile";
import "./people-profile.css";

const FRIENDS = "/people/friends";

function ProfileView({ userId }) {
  const profile = useStudentProfile(userId);
  const { status, error, busy, add, accept, decline, remove } = profile;
  const navigate = useNavigate();
  // Back returns to wherever the student came from (Friends, a group, their own Profile preview);
  // opened directly there is no history, so it goes to Friends.
  const fromHere = useLocation().key !== "default";
  const back = {
    to: FRIENDS,
    label: fromHere ? "Back" : "Back to Friends",
    onClick: fromHere ? (event) => { event.preventDefault(); navigate(-1); } : undefined,
  };

  let body;
  if (status === "loading") {
    body = <Skeleton height="420px" className="people-profile__skeleton" />;
  } else if (status === "ready") {
    const person = profile.profile;
    body = (
      <div className="profile stagger people-profile">
        <ProfileHero
          user={{ ...person, createdAt: person.memberSince }}
          counts={person.counts ?? {}}
          actions={!profile.isSelf && <ProfileActions person={person} {...{ busy, add, accept, decline, remove }} />}
        />
        {!profile.isSelf && person.sharedGroups.length > 0 && <SharedGroupsCard groups={person.sharedGroups} />}
      </div>
    );
  } else {
    const unavailable = status === "unavailable";
    body = (
      <EmptyState
        icon={UserRound}
        title={unavailable ? "Profile not available" : "Couldn't load this profile"}
        actions={
          unavailable
            ? <Button variant="secondary" to="/people/friends">Back to Friends</Button>
            : <Button variant="secondary" onClick={profile.retry}>Try again</Button>
        }
      >
        {error}
      </EmptyState>
    );
  }

  return (
    <Page title="Profile" back={back}>
      {body}
    </Page>
  );
}

// Another student's profile (Figma 326:2598, phone 292:2586 without the edit parts): the own page's hero, read-only, then Shared groups. Reached
// from the friends list, requests and group members at /people/:userId.
export default function ProfilePage() {
  const { userId } = useParams();
  return <ProfileView key={userId} userId={userId} />;
}
