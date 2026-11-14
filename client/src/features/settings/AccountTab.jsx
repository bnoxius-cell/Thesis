import { useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@/pages/authentication/AuthContext";
import { Button, Chip } from "@/shared/ui";
import { sendVerifyCode } from "@/shared/api/auth";
import SettingsRow, { SettingsGroup } from "./SettingsRow";
import PasswordDialog from "./PasswordDialog";
import VerifyEmailDialog from "./VerifyEmailDialog";

// How this student signs in. Google accounts may also hold a password (hasPassword).
const signInMethod = ({ authProvider, hasPassword }) => {
  if (authProvider !== "google") return "Email and password";
  return hasPassword ? "Google, and email and password" : "Google";
};

// Account (Figma 287:124 verified, 288:199 not verified, 291:3101 Google-only, phone 290:15488): the email
// with its verified state, a pointer to Profile, the password and how the student signs in.
export default function AccountTab() {
  const { userData, getUserData } = useAuth();
  const [dialog, setDialog] = useState(null); // "verify" | "change" | "set"
  const [sendingVerify, setSendingVerify] = useState(false);
  const user = userData ?? {};
  const googleOnly = user.authProvider === "google" && !user.hasPassword;

  // The code goes out first, so the dialog can say it was sent.
  const startVerify = async () => {
    setSendingVerify(true);
    const { error } = await sendVerifyCode();
    setSendingVerify(false);
    if (!error) return setDialog("verify");
    toast.error(error);
    getUserData(); // "already verified" means the chip is out of date
  };

  return (
    <>
      <SettingsGroup title="Your details">
        <SettingsRow label="Email" hint={`${user.email}. Only you see this.`} stacked={!user.isAccountVerified}>
          {user.isAccountVerified ? (
            <Chip tone="good">Verified</Chip>
          ) : (
            <>
              <Chip tone="watch">Not verified</Chip>
              <Button variant="secondary" busy={sendingVerify} onClick={startVerify}>Verify email</Button>
            </>
          )}
        </SettingsRow>
        <SettingsRow label="Picture, program and bio" hint="Edit these on your Profile.">
          <Button variant="ghost" to="/profile">Open Profile</Button>
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup title="Sign-in">
        <SettingsRow
          label="Password"
          hint={googleOnly ? "Add one to sign in with your email too." : "Use at least 8 characters."}
        >
          <Button variant="secondary" onClick={() => setDialog(googleOnly ? "set" : "change")}>
            {googleOnly ? "Set a password" : "Change"}
          </Button>
        </SettingsRow>
        <SettingsRow label="Signed in with" hint={signInMethod(user)} />
      </SettingsGroup>
      {/* Delete account card (frames 288:293, 291:2956) goes here once the server can delete an account. */}

      {dialog === "verify" && <VerifyEmailDialog onClose={() => setDialog(null)} />}
      {(dialog === "change" || dialog === "set") && <PasswordDialog mode={dialog} onClose={() => setDialog(null)} />}
    </>
  );
}
