import { useState } from "react";
import { toast } from "react-toastify";
import { Button, Field, Modal, SelectButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import { updateAvatar, updateProfile } from "@/shared/api/user";
import { useAuth } from "@/pages/authentication/AuthContext";
import ProfilePictureField from "./ProfilePictureField";
import "./profile.css";

// The limits match the server's (userController.updateProfile).
const MAX_NAME = 60;
const MAX_PROGRAM = 80;
const MAX_BIO = 200;

const PROGRAMS = ["BS Information Technology", "BS Computer Science"];
const OTHER = "__other__";

// The program list, plus the saved value when it isn't on it (an older account keeps it), then Other.
const programOptions = (saved) =>
  [...PROGRAMS, ...(saved && !PROGRAMS.includes(saved) ? [saved] : [])]
    .map((value) => ({ value, label: value }))
    .concat({ value: OTHER, label: "Other" });

// Edit profile (Figma 293:2133 dialog, 298:18892 phone sheet): the one place the picture, name, program
// and bio change. Nothing is saved until Save; closing with edits asks first. The picture goes first
// (its own request), then the text fields, and only what changed is sent. On success the signed-in
// user is updated in place, so the header, sidebar and menu change at once.
export default function EditProfileDialog({ onClose }) {
  const { userData: user, setUserData } = useAuth();
  const phone = useMediaQuery("(max-width: 480px)");
  const [form, setForm] = useState(() => ({
    avatar: user.avatar || "",
    name: user.name || "",
    program: user.program || PROGRAMS[0],
    custom: "",
    bio: user.bio || "",
  }));
  const [nameError, setNameError] = useState("");
  const [programError, setProgramError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const text = (key, clear) => (event) => {
    clear?.("");
    set(key)(event.target.value);
  };

  // What the form holds now against what the account holds now, so a half-finished save (the
  // picture went through, the rest didn't) only sends the rest next time.
  const program = (form.program === OTHER ? form.custom : form.program).trim();
  const name = form.name.trim();
  const bio = form.bio.trim();
  const picture = form.avatar !== (user.avatar || "") ? { avatar: form.avatar } : null;
  const fields = {};
  if (name !== user.name) fields.name = name;
  if (program && program !== user.program) fields.program = program;
  if (bio !== (user.bio || "")) fields.bio = bio;
  const dirty = Boolean(picture) || Object.keys(fields).length > 0;

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!name) return setNameError("Please enter your name.");
    if (!program) return setProgramError("Please enter your program.");
    if (!dirty) return onClose();

    setSaving(true);
    setError("");
    if (picture) {
      const { data, error: failure } = await updateAvatar(picture.avatar);
      if (failure) {
        setError(failure);
        setSaving(false);
        return;
      }
      setUserData((prev) => ({ ...prev, avatar: data.avatar }));
    }
    if (Object.keys(fields).length) {
      const { error: failure } = await updateProfile({
        ...(fields.name !== undefined && { studentName: fields.name }),
        ...(fields.program !== undefined && { program: fields.program }),
        ...(fields.bio !== undefined && { bio: fields.bio }),
      });
      if (failure) {
        setError(failure);
        setSaving(false);
        return;
      }
      setUserData((prev) => ({ ...prev, ...fields }));
    }
    setSaving(false);
    toast.success("Profile saved.");
    onClose();
  };

  return (
    <Modal
      as="form"
      onSubmit={submit}
      noValidate
      className="profile-dialog"
      title="Edit profile"
      subtitle="This is how other students see you."
      sheet
      busy={saving}
      onClose={onClose}
      confirmClose={() => dirty}
      actions={(close) => (
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
          <Button type="submit" busy={saving}>{saving ? "Saving" : "Save"}</Button>
        </>
      )}
    >
      <ProfilePictureField name={form.name || user.name} value={form.avatar} onChange={set("avatar")} disabled={saving} />
      <Field
        label="Name"
        value={form.name}
        maxLength={MAX_NAME}
        autoComplete="name"
        error={nameError}
        onChange={text("name", setNameError)}
      />
      <Field label="Program">
        {(control) => (
          <SelectButton
            block
            native={phone}
            options={programOptions(user.program)}
            value={form.program}
            onChange={(value) => {
              setProgramError("");
              set("program")(value);
            }}
            label="Program"
            {...control}
          />
        )}
      </Field>
      {form.program === OTHER && (
        <Field
          label="Your program"
          value={form.custom}
          maxLength={MAX_PROGRAM}
          error={programError}
          autoFocus
          onChange={text("custom", setProgramError)}
        />
      )}
      <Field
        label="Bio"
        multiline
        value={form.bio}
        maxLength={MAX_BIO}
        hint={`${form.bio.length} / ${MAX_BIO}`}
        onChange={text("bio")}
      />
      {error && <p className="profile-dialog__error" role="alert">{error}</p>}
    </Modal>
  );
}
