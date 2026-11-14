import { useState } from "react";
import { toast } from "react-toastify";
import { Button, Field, Modal } from "@/shared/ui";
import { savePasswordWithCode, sendPasswordCode } from "@/shared/api/auth";
import { useAuth } from "@/pages/authentication/AuthContext";
import CodeField, { CODE_LENGTH } from "./CodeField";

const MIN_PASSWORD = 8; // the server's rule (validateNewPassword)

const COPY = {
  change: {
    title: "Change password",
    subtitle: (email) => `We'll email a 6-digit code to ${email} first.`,
    body: () => "This keeps your account safe if someone else is using your device.",
  },
  set: {
    title: "Set a password",
    subtitle: () => "You sign in with Google now. A password lets you sign in with your email too.",
    body: (email) => `We'll email a 6-digit code to ${email} to make sure it's you. Google sign-in keeps working.`,
  },
};

// Change password (Figma 291:2382 then 291:2516; phone sheets 298:19026, 298:19104) and Set a password for a
// Google-only account (291:2678, 298:19198). Step 1 emails a code; step 2 takes the code and the new password
// twice. The server only changes the password with a valid code, never on the session alone.
export default function PasswordDialog({ mode, onClose }) {
  const { userData, getUserData } = useAuth();
  const email = userData.email;
  const copy = COPY[mode];
  const [step, setStep] = useState("send");
  const [form, setForm] = useState({ code: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const dirty = step === "code" && Boolean(form.code || form.password || form.confirm);
  const set = (key) => (value) => {
    setErrors({});
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const sendCode = async () => {
    setBusy(true);
    const { error } = await sendPasswordCode(email);
    setBusy(false);
    if (error) return setErrors({ form: error });
    setErrors({});
    setStep("code");
  };

  const checkForm = () => {
    if (form.code.length !== CODE_LENGTH) return { code: "Enter the 6-digit code from the email." };
    if (form.password.length < MIN_PASSWORD) return { password: `Use at least ${MIN_PASSWORD} characters.` };
    if (form.password !== form.confirm) return { confirm: "Those two passwords don't match." };
    return null;
  };

  const savePassword = async () => {
    const problems = checkForm();
    if (problems) return setErrors(problems);
    setBusy(true);
    const { error } = await savePasswordWithCode(email, form.code, form.password);
    if (error) {
      setBusy(false);
      return setErrors({ form: error });
    }
    await getUserData();
    setBusy(false);
    toast.success("Password updated.");
    onClose();
  };

  const submit = (event) => {
    event.preventDefault();
    if (busy) return;
    if (step === "send") sendCode();
    else savePassword();
  };

  return (
    <Modal
      as="form"
      onSubmit={submit}
      noValidate
      className="account-dialog"
      title={copy.title}
      subtitle={step === "send" ? copy.subtitle(email) : "Enter the code we emailed you, then pick a new password."}
      sheet
      busy={busy}
      onClose={onClose}
      confirmClose={() => dirty}
      actions={(close) => (
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
          <Button type="submit" busy={busy}>
            {step === "send" ? (busy ? "Sending" : "Send code") : busy ? "Saving" : "Save password"}
          </Button>
        </>
      )}
    >
      {step === "send" ? (
        <p className="account-dialog__text">{copy.body(email)}</p>
      ) : (
        <>
          <CodeField
            value={form.code}
            onChange={set("code")}
            error={errors.code}
            disabled={busy}
            onResend={() => sendPasswordCode(email)}
          />
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            error={errors.password}
            hint={`Use at least ${MIN_PASSWORD} characters.`}
            disabled={busy}
            onChange={(event) => set("password")(event.target.value)}
          />
          <Field
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            error={errors.confirm}
            disabled={busy}
            onChange={(event) => set("confirm")(event.target.value)}
          />
        </>
      )}
      {errors.form && <p className="account-dialog__error" role="alert">{errors.form}</p>}
    </Modal>
  );
}
