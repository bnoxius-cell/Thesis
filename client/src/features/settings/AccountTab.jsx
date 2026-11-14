import { useAuth } from "@/pages/authentication/AuthContext";
import { Button } from "@/shared/ui";
import SettingsRow, { SettingsGroup } from "./SettingsRow";

// How this student signs in. Google accounts may also hold a password (hasPassword).
const signInMethod = ({ authProvider, hasPassword }) => {
  if (authProvider !== "google") return "Email and password";
  return hasPassword ? "Google, and email and password" : "Google";
};

// Read-only for now (frames 287:124, 291:3101): the email, a pointer to Profile, and the sign-in
// method. The Verified chip, password row and Delete card wait for their own batches.
export default function AccountTab() {
  const { userData } = useAuth();
  return (
    <>
      <SettingsGroup title="Your details">
        <SettingsRow label="Email" hint={`${userData?.email}. Only you see this.`} />
        <SettingsRow label="Picture, program and bio" hint="Edit these on your Profile.">
          <Button variant="ghost" to="/profile">Open Profile</Button>
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup title="Sign-in">
        <SettingsRow label="Signed in with" hint={signInMethod(userData ?? {})} />
      </SettingsGroup>
    </>
  );
}
