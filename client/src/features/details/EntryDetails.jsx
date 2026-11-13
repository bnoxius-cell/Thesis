import { Link } from "react-router-dom";
import { CalendarDays, Clock, FileText, MapPin, Shapes, Timer, Video } from "lucide-react";
import { Button, Chip } from "@/shared/ui";
import useNow from "@/shared/hooks/useNow";
import { isWebLink, meetingProvider } from "@/utils/scheduleUtils";
import ItemDetailDialog, { DetailFooter } from "./ItemDetailDialog";
import { DetailRow, DetailRows } from "./DetailRows";
import { entryChip, entrySubtitle, entryWhen, linkLabel, prepText } from "./detailText";
import { entryIsLive, entrySubject, planDayHref, repeatText, subjectHref } from "./itemLinks";

// A class, activity, exam or event in the details window (Figma D2), on day `iso`. The week overview's entries
// carry the timetable they come from and whether the student may change them (`scheduleTitle`, `canEdit`);
// when `canEdit` is false the window says so instead of drawing Edit and Delete. `onEdit` and `onDelete`
// are passed only when the student can use them, and a missing one draws no button.
export default function EntryDetails({ entry, iso, subjects, context, onClose, returnFocusRef, onEdit, onDelete }) {
  const now = useNow();
  const subject = entrySubject(entry, subjects);
  const live = entryIsLive(entry, iso, now);
  const chip = entryChip(entry, iso, now, live);
  const provider = entry.meetingUrl && isWebLink(entry.meetingUrl) ? meetingProvider(entry.meetingUrl) : null;
  const shared = entry.canEdit === false;
  const handlers = { close: onClose };

  const inThisSubject = subject && context === `subject:${subject._id}`;
  // Plan's own week already shows the entry, so it is the only place that doesn't offer the way there.
  const primary = subject && !inThisSubject ? (
    <Button className="item-footer__go" to={subjectHref(subject._id)} onClick={onClose}>Open subject</Button>
  ) : context !== "plan-week" && (
    <Button className="item-footer__go" to={planDayHref(iso, now)} onClick={onClose}>See it in Plan</Button>
  );

  const canChange = entry.canEdit !== false;
  const footer = (
    <DetailFooter
      note={shared && `From ${entry.scheduleTitle || "another timetable"}. Only its owner and editors can change it.`}
      remove={canChange && onDelete && (
        <Button variant="ghost" className="item-footer__delete" onClick={() => onDelete(entry, handlers)}>
          Delete
        </Button>
      )}
      edit={canChange && onEdit && (
        <Button variant="secondary" className="item-footer__edit" onClick={() => onEdit(entry, handlers)}>
          Edit
        </Button>
      )}
      primary={primary}
    />
  );

  return (
    <ItemDetailDialog
      title={entry.title}
      subtitle={entrySubtitle(entry, iso, repeatText(entry.days))}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      footer={footer}
    >
      {chip && <Chip tone={chip.tone} className="item-chip">{chip.label}</Chip>}
      <DetailRows>
        <DetailRow icon={Clock} label="When">{entryWhen(entry, iso)}</DetailRow>
        <DetailRow icon={MapPin} label={entry.kind === "event" ? "Place" : "Room"}>{entry.location}</DetailRow>
        <DetailRow icon={Video} label="Meeting link" split>
          {provider && (
            <>
              <a className="detail-link detail-link--clip" href={entry.meetingUrl} target="_blank" rel="noopener noreferrer">
                {linkLabel(entry.meetingUrl)}
              </a>
              <Button
                variant="secondary"
                href={entry.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Join ${entry.title}${provider.name ? ` on ${provider.name}` : ""}`}
              >
                Join
              </Button>
            </>
          )}
        </DetailRow>
        <DetailRow icon={Timer} label="Prep">{entry.kind === "exam" ? prepText(entry.prepHours) : ""}</DetailRow>
        <DetailRow icon={Shapes} label="Subject">
          {subject && !inThisSubject && (
            <Link className="detail-link" to={subjectHref(subject._id)} onClick={onClose}>{subject.name}</Link>
          )}
        </DetailRow>
        <DetailRow icon={CalendarDays} label="Timetable">
          {entry.scheduleTitle && `${entry.scheduleTitle}${shared ? " (shared with you)" : ""}`}
        </DetailRow>
        <DetailRow icon={FileText} label="Notes">
          {entry.notes && <span className="detail-notes">{entry.notes}</span>}
        </DetailRow>
      </DetailRows>
    </ItemDetailDialog>
  );
}
