import { useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { Button, Field, Modal, Segment, SelectButton, Switch } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import useSendFeedback from "./useSendFeedback";
import {
  FEEDBACK_KINDS,
  FEEDBACK_MAX,
  emptyFeedbackForm,
  feedbackErrors,
  feedbackPayload,
  feedbackStarted,
} from "./feedbackForm";
import "./feedback.css";

// Send feedback (no Figma frame: built from the shared dialog parts in the style of the task dialogs).
// Nothing is sent until the button; closing asks first when something was typed. A failed send keeps
// the dialog open with the server's message (too soon, already sent, too many today).
export default function FeedbackDialog({ onClose }) {
  const [form, setForm] = useState(emptyFeedbackForm);
  const [errors, setErrors] = useState({});
  const { send, sending, error } = useSendFeedback();
  const { pathname } = useLocation();
  const phone = useMediaQuery("(max-width: 480px)");
  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = feedbackErrors(form);
    if (Object.keys(found).length > 0) return setErrors(found);
    // The page and the device are read now, not when the dialog opened.
    if (!(await send(feedbackPayload(form, pathname, window.innerWidth)))) return;
    toast.success("Thanks! Your feedback was sent.");
    onClose();
  };

  return (
    <Modal
      as="form"
      onSubmit={submit}
      noValidate
      sheet
      className="feedback-dialog"
      title="Send feedback"
      subtitle="Tell us what's working and what isn't. It goes straight to the StressCare team."
      busy={sending}
      onClose={onClose}
      confirmClose={() => feedbackStarted(form)}
      actions={(close) => (
        <>
          <Button variant="ghost" onClick={close} disabled={sending}>Cancel</Button>
          <Button type="submit" busy={sending}>{sending ? "Sending" : "Send"}</Button>
        </>
      )}
    >
      <Field label="What's it about?">
        {(control) =>
          phone ? (
            <SelectButton block native options={FEEDBACK_KINDS} value={form.kind} onChange={set("kind")} label="Kind of feedback" {...control} />
          ) : (
            <Segment labelId={control.labelId} options={FEEDBACK_KINDS} value={form.kind} onChange={set("kind")} />
          )
        }
      </Field>
      <Field
        label="Your feedback"
        className="feedback-dialog__message"
        multiline
        rows={5}
        value={form.message}
        onChange={(event) => set("message")(event.target.value)}
        error={errors.message}
        hint={`${form.message.length} / ${FEEDBACK_MAX}`}
        maxLength={FEEDBACK_MAX}
        placeholder="What happened, or what would help?"
      />
      <div className="feedback-dialog__contact">
        <span id="feedback-contact" className="feedback-dialog__contact-label">You can email me about this</span>
        <Switch labelId="feedback-contact" checked={form.canContact} onChange={set("canContact")} disabled={sending} />
      </div>
      <p className="feedback-dialog__note">
        We save this with your account, the page you were on and your device type.{" "}
        <a href="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</a>
      </p>
      {error && <p className="feedback-dialog__error" role="alert">{error}</p>}
    </Modal>
  );
}
