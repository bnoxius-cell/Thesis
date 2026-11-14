import { useState } from "react";
import { toast } from "react-toastify";
import { Button, Modal } from "@/shared/ui";
import { sendVerifyCode, verifyEmailWithCode } from "@/shared/api/auth";
import { useAuth } from "@/pages/authentication/AuthContext";
import CodeField, { CODE_LENGTH } from "./CodeField";

// Verify your email (Figma 291:2812, phone sheet 298:19276). The Account tab has already emailed the
// code when this opens; the student types it here, the same check as at sign-up.
export default function VerifyEmailDialog({ onClose }) {
  const { userData, getUserData } = useAuth();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (code.length !== CODE_LENGTH) return setCodeError("Enter the 6-digit code from the email.");
    setBusy(true);
    const { error: failure } = await verifyEmailWithCode(code);
    if (failure) {
      setBusy(false);
      return setError(failure);
    }
    await getUserData();
    setBusy(false);
    toast.success("Email verified.");
    onClose();
  };

  return (
    <Modal
      as="form"
      onSubmit={submit}
      noValidate
      className="account-dialog"
      title="Verify your email"
      subtitle={`We sent a 6-digit code to ${userData.email}.`}
      sheet
      busy={busy}
      onClose={onClose}
      confirmClose={() => Boolean(code)}
      actions={(close) => (
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
          <Button type="submit" busy={busy}>{busy ? "Verifying" : "Verify"}</Button>
        </>
      )}
    >
      <CodeField
        value={code}
        onChange={(value) => {
          setCodeError("");
          setError("");
          setCode(value);
        }}
        error={codeError}
        disabled={busy}
        onResend={sendVerifyCode}
      />
      {error && <p className="account-dialog__error" role="alert">{error}</p>}
    </Modal>
  );
}
