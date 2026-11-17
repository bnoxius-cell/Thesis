import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Users } from "lucide-react";
import { Button, EmptyState, Field, Modal, Skeleton, showActionToast } from "@/shared/ui";
import { sendMessage, shareToGroup } from "@/shared/api/groups";
import useGroups from "@/features/people/useGroups";
import PeopleAvatar from "@/features/people/PeopleAvatar";
import "@/features/people/people.css"; // the avatar rule lives here
import ErrorNote from "./ErrorNote";
import { SHARE_KINDS } from "./shareKinds";
import "./share.css";

const NOTE_MAX = 200;

const memberLine = (group) => `${group.members.length} ${group.members.length === 1 ? "member" : "members"}`;

// "Share to a group" (Figma SH-1): one of the student's own items goes to a group as a card. They pick a group and
// may add a short message, which goes out as a second chat message only when they typed one. The group's own
// refusals (the family filter, a reviewer that isn't ready) show here in the server's words and the dialog stays
// open. If the card went out and only the message was refused, the card is not sent again on the next try.
//   kind  a key of SHARE_KINDS
//   item  what the page has: a task, a timetable summary or a reviewer
export default function ShareToGroupDialog({ kind, item, onClose }) {
  const navigate = useNavigate();
  const spec = SHARE_KINDS[kind];
  const { groups, status, error: loadError, reload } = useGroups();
  const [picked, setPicked] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [cardSent, setCardSent] = useState(false);
  const [cardError, setCardError] = useState("");
  const [noteError, setNoteError] = useState("");
  const Icon = spec.icon;

  const group = groups?.find((g) => g._id === picked) ?? groups?.[0];

  const announce = () =>
    showActionToast(`Shared to ${group.name}`, { label: "View", onAction: () => navigate(`/people/groups/${group._id}`) });

  // Closing after the card went out still says so, even if the message didn't.
  const leave = () => {
    if (cardSent) announce();
    onClose();
  };

  const send = async (event) => {
    event.preventDefault();
    setBusy(true);
    setCardError("");
    setNoteError("");
    if (!cardSent) {
      const card = await shareToGroup(group._id, spec.body(item));
      if (!card.data) {
        setBusy(false);
        setCardError(card.error);
        return;
      }
      setCardSent(true);
    }
    const text = note.trim();
    if (text) {
      const sent = await sendMessage(group._id, text);
      if (!sent.data) {
        setBusy(false);
        setNoteError(sent.error);
        return;
      }
    }
    announce();
    onClose();
  };

  const empty = status === "ready" && groups.length === 0;
  const ready = status === "ready" && !empty;

  let body;
  if (status === "loading") {
    body = (
      <div className="share-groups" role="status" aria-label="Loading your groups">
        {[0, 1, 2].map((n) => <Skeleton key={n} className="share-groups__skeleton" height="60px" />)}
      </div>
    );
  } else if (status === "failed") {
    body = (
      <ErrorNote action={<Button variant="secondary" size="sm" onClick={reload}>Try again</Button>}>{loadError}</ErrorNote>
    );
  } else if (empty) {
    body = (
      <EmptyState icon={Users} title="You're not in a group yet" className="share-empty">
        Join or start a group in People, then you can share from here.
      </EmptyState>
    );
  } else {
    body = (
      <>
        <fieldset className="share-groups" disabled={busy || cardSent}>
          <legend className="share-groups__legend">Choose a group</legend>
          {groups.map((g) => (
            <label key={g._id} className="share-group">
              <PeopleAvatar name={g.name} src={g.icon} className="share-group__avatar" />
              <span className="share-group__text">
                <span className="share-group__name">{g.name}</span>
                <span className="share-group__meta">{memberLine(g)}</span>
              </span>
              <input
                type="radio"
                name="share-group"
                className="share-group__radio"
                checked={g._id === group._id}
                onChange={() => setPicked(g._id)}
              />
            </label>
          ))}
        </fieldset>
        <Field
          label="Message (optional)"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteError("");
          }}
          maxLength={NOTE_MAX}
          placeholder="Say something about it"
          hint={`${note.length} / ${NOTE_MAX}`}
          error={noteError}
          autoComplete="off"
        />
        {cardError && <ErrorNote>{cardError}</ErrorNote>}
      </>
    );
  }

  return (
    <Modal
      as="form"
      title="Share to a group"
      subtitle={spec.blurb}
      busy={busy}
      sheet
      className="share-dialog"
      onClose={leave}
      onSubmit={send}
      actions={
        <>
          <Button variant="secondary" onClick={leave} disabled={busy}>Cancel</Button>
          {empty ? (
            <Button to="/people" icon={Users} onClick={onClose}>Go to People</Button>
          ) : (
            <Button type="submit" icon={Send} busy={busy} disabled={!ready}>Send</Button>
          )}
        </>
      }
    >
      <div className="share-item">
        <span className="share-item__tile"><Icon size={20} aria-hidden="true" /></span>
        <span className="share-item__text">
          <span className="share-item__title">{spec.title(item)}</span>
          <span className="share-item__line">{spec.line(item)}</span>
        </span>
      </div>
      {body}
    </Modal>
  );
}
