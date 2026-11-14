import { useId, useRef, useState } from "react";
import { Avatar, Button } from "@/shared/ui";
import { AVATAR_PICTURE, compressImage } from "@/utils/scheduleUtils";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// The photo row of Edit profile (Figma 293:2227): the picture (or the initial), Change photo and
// Remove. A picked file is shrunk here to a small JPEG; `onChange` gets that data URL, or "" for
// Remove. Nothing is saved until the dialog's Save. Keyed on the picture so a new one fades in.
export default function ProfilePictureField({ name, value, onChange, disabled, focusRef }) {
  const input = useRef(null);
  const hintId = useId();
  const [error, setError] = useState("");

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // picking the same file again still fires
    if (!file) return;
    setError("");
    if (file.size > MAX_PHOTO_BYTES) {
      setError("That photo is over 5 MB. Please pick a smaller one.");
      return;
    }
    try {
      onChange(await compressImage(file, AVATAR_PICTURE));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="profile-photo">
      <Avatar key={value || "initial"} name={name} src={value} size="field" className="profile-photo__img" />
      <div className="profile-photo__side">
        <div className="profile-photo__buttons">
          <Button ref={focusRef} variant="ghost" onClick={() => input.current?.click()} disabled={disabled} aria-describedby={hintId}>
            Change photo
          </Button>
          <Button variant="ghost" onClick={() => { setError(""); onChange(""); }} disabled={disabled || !value}>
            Remove
          </Button>
        </div>
        {error ? (
          <p id={hintId} className="profile-photo__error" role="alert">{error}</p>
        ) : (
          <p id={hintId} className="profile-photo__hint">JPG or PNG, up to 5 MB.</p>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pick} />
    </div>
  );
}
