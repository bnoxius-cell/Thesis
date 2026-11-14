import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Field } from "@/shared/ui";

export const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

// The 6-digit emailed code (Figma 291:2516, 291:2812): digits only, offered by the phone's keyboard
// from the email (one-time-code), with "Didn't get it? Send a new code" under it. A code was just
// sent when this mounts, so the resend link waits out a cooldown first. `onResend` answers { error }.
export default function CodeField({ value, onChange, error, onResend, disabled }) {
  const [wait, setWait] = useState(RESEND_COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const resend = async () => {
    setSending(true);
    const { error: failure } = await onResend();
    setSending(false);
    if (failure) {
      toast.error(failure);
      return;
    }
    toast.success("We sent you a new code.");
    setWait(RESEND_COOLDOWN_SECONDS);
  };

  return (
    <div className="account-code">
      <Field
        label="6-digit code"
        value={value}
        error={error}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={CODE_LENGTH}
        autoFocus
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
      />
      <p className="account-code__resend">
        Didn&apos;t get it?{" "}
        <button type="button" className="account-code__link" onClick={resend} disabled={disabled || sending || wait > 0}>
          {wait > 0 ? `Send a new code in ${wait}s` : sending ? "Sending" : "Send a new code"}
        </button>
      </p>
    </div>
  );
}
