import { Link } from "react-router-dom";
import { ChevronRight, LogOut } from "lucide-react";
import { Avatar, Badge } from "@/shared/ui";
import { useAuth } from "@/pages/authentication/AuthContext";
import useWhatsNew from "@/features/whats-new/useWhatsNew";
import { SECTIONS, sectionPath } from "./settingsSections";

// The phone's first screen (frame 290:15286): a profile card that opens Profile, then one card
// with each Settings area and a plain Log out row at the end.
export default function SettingsList() {
  const { userData, logout } = useAuth();
  const { hasUnseen } = useWhatsNew();
  const name = userData?.name || "Student";
  return (
    <div className="settings-list">
      <Link to="/profile" className="settings-profile">
        <Avatar name={name} src={userData?.avatar} />
        <span className="settings-profile__who">
          <span className="settings-profile__name">{name}</span>
          {userData?.program && <span className="settings-profile__program">{userData.program}</span>}
        </span>
        <ChevronRight size={20} aria-hidden="true" />
      </Link>
      <nav aria-label="Me" className="settings-menu">
        {SECTIONS.map(({ key, label, icon: Icon, dot }) => (
          <Link key={key} to={sectionPath(key)} className="settings-menu__row" data-first={key === "settings" || undefined}>
            <Icon size={20} aria-hidden="true" />
            <span className="settings-menu__label">{label}</span>
            {dot && hasUnseen && (
              <>
                <Badge dot />
                <span className="sr-only">New updates</span>
              </>
            )}
            <ChevronRight size={20} aria-hidden="true" />
          </Link>
        ))}
        <button type="button" className="settings-menu__row" onClick={() => logout()}>
          <LogOut size={20} aria-hidden="true" />
          <span className="settings-menu__label">Log out</span>
        </button>
      </nav>
    </div>
  );
}
