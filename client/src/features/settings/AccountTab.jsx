import { useAuth } from "@/pages/authentication/AuthContext";
import { Button } from "@/shared/ui";
import SettingsRow, { SettingsGroup } from "./SettingsRow";

// How this student signs in. Google accounts may also hold a password (hasPassword).
const signInMethod = ({ authProvider, hasPassword }) => {
  if (authProvider !== "google") return "Email and password";
  return hasPassword ? "Google, and email and password" : "Google";
};

// Read-only for now: the email, the sign-in method, and a pointer to Profile for the rest.
export default function AccountTab() {
  const { userData } = useAuth();
  return (
    <>
      <SettingsGroup title="Your details">
        <SettingsRow label="Email" hint="Only you see this">
          <span className="settings-row__value">{userData?.email}</span>
        </SettingsRow>
        <SettingsRow label="Picture, program and bio" hint="Edit these on your Profile.">
          <Button variant="secondary" size="sm" to="/profile">Open Profile</Button>
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup title="Sign-in">
        <SettingsRow label="Signed in with">
          <span className="settings-row__value">{signInMethod(userData ?? {})}</span>
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}
