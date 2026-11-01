import { useParams } from "react-router-dom";
import { UserRound } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui";
import Page from "@/app/shell/Page";
import ProfileCard from "./ProfileCard";
import ProfileGroups from "./ProfileGroups";
import useStudentProfile from "./useStudentProfile";
import "./people.css"; // the picture's rules (.people-avatar)
import "./people-profile.css";

const BACK = { to: "/people/friends", label: "Back to Friends" };

function ProfileView({ userId }) {
  const profile = useStudentProfile(userId);
  const { status, error, busy, add, accept, decline, remove } = profile;

  let body;
  if (status === "loading") {
    body = <Skeleton height="301px" className="people-profile__skeleton" />;
  } else if (status === "ready") {
    const person = profile.profile;
    body = (
      <div className="people-profile">
        <ProfileCard person={person} isSelf={profile.isSelf} actions={{ busy, add, accept, decline, remove }} />
        {!profile.isSelf && person.sharedGroups.length > 0 && <ProfileGroups groups={person.sharedGroups} />}
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
    <Page title="Profile" back={BACK}>
      {body}
    </Page>
  );
}

// Another student's profile (Figma 66:759, no phone frame: the card and the groups stack). Reached
// from the friends list, requests and group members at /people/:userId.
export default function ProfilePage() {
  const { userId } = useParams();
  return <ProfileView key={userId} userId={userId} />;
}
