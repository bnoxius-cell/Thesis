import { useState } from "react";
import { toast } from "react-toastify";
import { CircleCheck, RotateCcw, Users } from "lucide-react";
import { Button, Chip } from "@/shared/ui";
import useNow from "@/shared/hooks/useNow";
import { ErrorNote } from "@/features/share";
import { SHARE_CARDS } from "./shareCards";

// Something a person posted in the chat as a card (Figma SH-2): a task, a reviewer, a subject, a deck or a timetable. The reader gets
// one button that makes their own copy. Working, failed (with the reason and "Try again") and done show on the card
// itself. The sender's own card has no button. What each kind says and calls is in shareCards.js.
//   plan   { groupId, onAdded } from the group view
export default function ShareCard({ message, mine, sender, plan }) {
  const card = SHARE_CARDS[message.type];
  const now = useNow();
  const [work, setWork] = useState({ busy: false, error: "", saved: null, justAdded: false });
  const Icon = card.icon;
  const title = card.title(message);
  const by = mine ? "you" : sender?.name ?? message.schedule?.ownerName ?? "someone";
  const chip = card.chip?.(message, now);
  const rows = card.rows?.(message) ?? [];

  const add = async () => {
    setWork((prev) => ({ ...prev, busy: true, error: "" }));
    const res = await card.add(plan, message);
    const already = card.alreadyIs409 && res.status === 409;
    if (!res.data && !already) {
      setWork((prev) => ({ ...prev, busy: false, error: res.error }));
      return;
    }
    if (!already) toast.success(card.toast);
    setWork({ busy: false, error: "", saved: res.data?.saved ?? null, justAdded: true });
    plan.onAdded(message._id);
  };

  const label = work.error ? "Try again" : work.busy ? card.busy : card.action;
  let footer;
  // The sender's own copy carries the share tag too, so a card with a "Shared by you" line shows that, not "added".
  if (message.addedByMe && !(mine && card.own)) {
    const open = card.open;
    footer = card.inline ? (
      <Chip tone="good" className="people-card__done">{card.done}</Chip>
    ) : (
      <div className={`people-card__added ${work.justAdded ? "is-settling" : ""}`.trim()} role="status">
        <CircleCheck size={20} aria-hidden="true" />
        <span>{card.done}</span>
        {open && (
          <Button variant="ghost" size="sm" to={work.saved ? open.to(work.saved) : open.fallback} aria-label={`${open.label}: ${title}`}>
            {open.label}
          </Button>
        )}
      </div>
    );
  } else if (mine) {
    footer = card.own && (
      <p className="people-card__own">
        <Users size={20} aria-hidden="true" />
        <span>Shared by you. Groupmates add their own copy.</span>
      </p>
    );
  } else {
    footer = (
      <>
        {work.error && <ErrorNote>{work.error}</ErrorNote>}
        <Button
          variant="secondary"
          icon={work.error ? RotateCcw : undefined}
          busy={work.busy}
          onClick={add}
          aria-label={label === card.action ? `${card.action}: ${title}` : undefined}
        >
          {label}
        </Button>
      </>
    );
  }

  return (
    <div className={`people-card ${message.fresh ? "is-entering" : ""}`.trim()}>
      {card.inline ? (
        <div className="people-card__top">
          <span className="people-card__icon">
            <Icon size={20} aria-hidden="true" />
          </span>
          <div className="people-card__text">
            <p className="people-card__title">{title}</p>
            <p className="people-card__sub">{card.sub(message, by)}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="people-card__head">
            <span className="people-card__tile">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="people-card__eyebrow">{card.eyebrow}</span>
          </div>
          <div className="people-card__text">
            <p className="people-card__title">{title}</p>
            <p className="people-card__sub">{card.sub(message, by)}</p>
          </div>
        </>
      )}
      {rows.length > 0 && (
        <ul className="people-card__rows">
          {rows.map(({ icon: RowIcon, text }, index) => (
            <li key={index} className="people-card__row">
              <RowIcon size={20} aria-hidden="true" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      )}
      {chip && <Chip tone={chip.tone}>{chip.label}</Chip>}
      {card.note && <p className="people-card__note">{card.note}</p>}
      {footer}
    </div>
  );
}
