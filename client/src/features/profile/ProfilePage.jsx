import { useState } from "react";
import Page from "@/app/shell/Page";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import { useAuth } from "@/pages/authentication/AuthContext";
import EditProfileDialog from "./EditProfileDialog";
import ProfileHero from "./ProfileHero";
import { GroupsCard, RhythmCard } from "./ProfileCards";
import useProfileStats from "./useProfileStats";
import "./profile.css";

// /profile (Figma 290:16329 desktop, 292:2586 phone): the student's own page. One page, no tabs.
// Picture, name, program and bio are edited in the one Edit profile dialog; the rhythm numbers
// belong to Wellbeing. Reached from the avatar menu and, on a phone, the Me list.
export default function ProfilePage() {
  const { userData } = useAuth();
  const phone = useMediaQuery("(max-width: 1023px)");
  const [editing, setEditing] = useState(false);
  const stats = useProfileStats();
  const counts = { ...stats, groups: stats.groups?.length ?? null };

  return (
    <Page title="Profile" back={phone ? { to: "/settings", label: "Back to Me" } : undefined}>
      <div className="profile stagger">
        <ProfileHero user={userData} counts={counts} onEdit={() => setEditing(true)} />
        <RhythmCard user={userData} />
        <GroupsCard groups={stats.groups} />
      </div>
      {editing && <EditProfileDialog onClose={() => setEditing(false)} />}
    </Page>
  );
}
