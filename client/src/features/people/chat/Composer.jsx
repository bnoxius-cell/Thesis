import { useLayoutEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

const MAX_LENGTH = 1000; // what the server accepts

// The message box and send button. Enter sends, Shift+Enter starts a new line, and the box grows
// with the text. The text clears at once; if the send fails it goes back into the box.
export default function Composer({ label, placeholder, onSend }) {
  const [draft, setDraft] = useState("");
  const box = useRef(null);

  useLayoutEffect(() => {
    const el = box.current;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`; // scrollHeight leaves out the 1px borders
  }, [draft]);

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const { ok } = await onSend(text);
    if (!ok) setDraft((now) => (now ? `${text}\n${now}` : text));
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      className="people-composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={box}
        className="people-composer__box"
        rows={1}
        maxLength={MAX_LENGTH}
        value={draft}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="send"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {/* Keeps focus in the box when the button is pressed, so the phone keyboard stays up. */}
      <button
        type="submit"
        className="people-composer__send"
        aria-label="Send message"
        disabled={!draft.trim()}
        onMouseDown={(event) => event.preventDefault()}
      >
        <Send size={20} aria-hidden="true" />
      </button>
    </form>
  );
}
