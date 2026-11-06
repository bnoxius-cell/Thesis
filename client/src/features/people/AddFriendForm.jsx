import { useEffect, useId, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/shared/ui";

const CODE_LENGTH = 6;

// "Add a friend" (Figma 66:752): a classmate's friend code and Send request. `inputRef` lets the
// page focus the field (the People "+" menu, the empty Friends button). The server says if the code
// is unknown, is the student's own, or they are already friends, and the toast shows its words.
// `focusSignal` changes each time the "+" menu is used (null otherwise), so the field takes focus
// again even when the address is already `?add=1`.
export default function AddFriendForm({ inputRef, focusSignal, busy, onSend }) {
  const [code, setCode] = useState("");
  const inputId = useId();

  useEffect(() => {
    if (focusSignal) inputRef.current?.focus();
  }, [focusSignal, inputRef]);

  const submit = async (event) => {
    event.preventDefault();
    const tag = code.trim().toUpperCase();
    if (tag.length !== CODE_LENGTH) {
      toast.error(`A friend code has ${CODE_LENGTH} characters.`);
      return;
    }
    if (await onSend(tag)) setCode("");
  };

  return (
    <form className="people-card people-add" onSubmit={submit}>
      <h2 className="people-add__title">Add a friend</h2>
      <p className="people-add__hint">Enter the code a classmate shared with you.</p>
      <label htmlFor={inputId} className="sr-only">Friend code</label>
      <input
        ref={inputRef}
        id={inputId}
        className="people-add__input"
        type="text"
        placeholder="Friend code"
        maxLength={CODE_LENGTH}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="send"
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
      />
      <Button type="submit" busy={busy} disabled={code.trim().length === 0}>
        {busy ? "Sending..." : "Send request"}
      </Button>
    </form>
  );
}
