import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { compressImage, AVATAR_PICTURE } from "../utils/scheduleUtils";

// Pick, replace or remove a small picture (profile photo or group icon). The photo is
// cropped and shrunk in the browser, then handed to onChange as a data URL ("" = removed).
export default function PictureField({ value, onChange, name, square = false, size = 88, disabled = false, chooseLabel = "Choose photo" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // lets the same file be picked again later
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      onChange(await compressImage(file, AVATAR_PICTURE));
    } catch (err) {
      setError(err.message || "That picture couldn't be used.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="picture-field">
      <UserAvatar name={name} src={value} size={size} square={square} />
      <div className="picture-field-actions">
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
        <button type="button" className="secondary-button small" onClick={() => inputRef.current?.click()} disabled={busy || disabled}>
          <Camera size={15} aria-hidden="true" /> {busy ? "Working..." : value ? "Change" : chooseLabel}
        </button>
        {value && (
          <button type="button" className="ghost-button small" onClick={() => { setError(""); onChange(""); }} disabled={busy || disabled}>
            <Trash2 size={15} aria-hidden="true" /> Remove
          </button>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
