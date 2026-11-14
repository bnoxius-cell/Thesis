import { Link } from "react-router-dom";
import { ChevronRight, LogOut, User } from "lucide-react";
import { Badge } from "@/shared/ui";
import { useAuth } from "@/pages/authentication/AuthContext";
import useWhatsNew from "@/features/whats-new/useWhatsNew";
import { SECTIONS, sectionPath } from "./settingsSections";

// The phone's first screen (frame 290:15286): Profile, then each Settings area, then Log out.
export default function SettingsList() {
  const { logout } = useAuth();
  const { hasUnseen } = useWhatsNew();
  return (
    <nav aria-label="Me" className="settings-list">
      <Link to="/profile" className="settings-list__row">
        <User size={20} aria-hidden="true" />
        <span className="settings-list__label">Profile</span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
      {SECTIONS.map(({ key, label, icon: Icon, dot }) => (
        <Link key={key} to={sectionPath(key)} className="settings-list__row">
          <Icon size={20} aria-hidden="true" />
          <span className="settings-list__label">{label}</span>
          {dot && hasUnseen && (
            <>
              <Badge dot />
              <span className="sr-only">New updates</span>
            </>
          )}
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      ))}
      <button type="button" className="settings-list__row" onClick={() => logout()}>
        <LogOut size={20} aria-hidden="true" />
        <span className="settings-list__label">Log out</span>
      </button>
    </nav>
  );
}
