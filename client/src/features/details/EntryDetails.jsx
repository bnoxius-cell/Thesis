import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CalendarDays, Clock, FileText, MapPin, Shapes, Timer, Video } from "lucide-react";
import { toast } from "react-toastify";
import { createSubject } from "@/shared/api/subjects";
import { Button, Chip } from "@/shared/ui";
import useNow from "@/shared/hooks/useNow";
import { useEntryLayer } from "@/features/plan/shared";
import { isWebLink, meetingProvider } from "@/utils/scheduleUtils";
import ItemDetailDialog, { DetailFooter } from "./ItemDetailDialog";
import { DetailRow, DetailRows } from "./DetailRows";
import { entryChip, entrySubtitle, entryWhen, linkLabel, prepText } from "./detailText";
import { entryIsLive, entrySubject, planDayHref, repeatText, subjectHref } from "./itemLinks";

// A class, activity, exam or event in the details window (Figma D2), on day `iso`. The week overview's entries
// carry the timetable they come from and whether the student may change them (`scheduleTitle`, `canEdit`);
// when `canEdit` is false the window says so instead of drawing Edit and Delete. `onEdit` and `onDelete`
// are passed only when the student can use them, and a missing one draws no button. `focus` ("edit" or
// "delete") puts focus on that button when the window comes back from its dialog.
// A class of a timetable shared with the student (it carries `myChoice`) also shows what they chose for it, and
// when the page gave a `choice` (useClassChoice) the ways to change that: see useEntryLayer. On such a class
// Edit and Delete move into the Class options menu ("for everyone"); on the student's own copy there is Edit.
// A class that is none of the student's subjects (Figma CT-F3 429:1682, viewer 429:2249) says so and offers "Make
// it a subject": it creates one named like the class, tells the page (`onSubjectMade` reads the week and subjects
// again, which links the class by name) and the window then offers "Open subject" in its place.
export default function EntryDetails({ entry, iso, subjects, context, choice, onClose, onBack, returnFocusRef, focus, onEdit, onDelete, onSubjectMade }) {
  const editRef = useRef(null);
  const deleteRef = useRef(null);
  const now = useNow();
  const [made, setMade] = useState(null); // the subject "Make it a subject" just created
  const [making, setMaking] = useState(false);
  const subject = entrySubject(entry, subjects) ?? made;
  const unlinked = entry.kind === "class" && !subject;
  const live = entryIsLive(entry, iso, now);
  const chip = entryChip(entry, iso, now, live);
  const provider = entry.meetingUrl && isWebLink(entry.meetingUrl) ? meetingProvider(entry.meetingUrl) : null;
  const shared = entry.canEdit === false;
  const handlers = { close: onClose };
  const layer = useEntryLayer({ entry, choice, handlers, onEdit, onDelete });

  const makeSubject = async () => {
    setMaking(true);
    const { data, error } = await createSubject({ name: entry.title });
    setMaking(false);
    if (error) return toast.error(error);
    setMade(data.subject);
    onSubjectMade?.();
  };

  const inThisSubject = subject && context === `subject:${subject._id}`;
  // Plan's own week already shows the entry, so it is the only place that doesn't offer the way there.
  const primary = unlinked ? (
    <Button className="item-footer__go" busy={making} onClick={makeSubject}>Make it a subject</Button>
  ) : subject && !inThisSubject ? (
    <Button className="item-footer__go" to={subjectHref(subject._id)} onClick={onClose}>Open subject</Button>
  ) : context !== "plan-week" && (
    <Button className="item-footer__go" to={planDayHref(iso, now)} onClick={onClose}>See it in Plan</Button>
  );

  const canChange = entry.canEdit !== false;
  const footer = (
    <DetailFooter
      note={shared && !layer && `From ${entry.scheduleTitle || "another timetable"}. Only its owner and editors can change it.`}
      remove={layer ? layer.start : canChange && onDelete && (
        <Button ref={deleteRef} variant="ghost" className="item-footer__delete" onClick={() => onDelete(entry, handlers)}>
          Delete
        </Button>
      )}
      edit={(!layer || layer.isCopy) && canChange && onEdit && (
        <Button ref={editRef} variant="secondary" className="item-footer__edit" onClick={() => onEdit(entry, handlers)}>
          Edit
        </Button>
      )}
      primary={layer?.publish || layer?.propose || primary}
    />
  );

  return (
    <ItemDetailDialog
      title={entry.title}
      subtitle={entrySubtitle(entry, iso, repeatText(entry.days))}
      onClose={onClose}
      onBack={onBack}
      returnFocusRef={returnFocusRef}
      initialFocusRef={focus === "delete" ? deleteRef : focus === "edit" ? editRef : undefined}
      footer={footer}
    >
      {layer?.notice}
      {(chip || layer?.chip || layer?.proposalChip) && (
        <div className="item-chips">
          {chip && <Chip tone={chip.tone} className="item-chip">{chip.label}</Chip>}
          {layer?.chip && <Chip tone={layer.chip.tone} className="item-chip">{layer.chip.label}</Chip>}
          {layer?.proposalChip && <Chip tone={layer.proposalChip.tone} className="item-chip">{layer.proposalChip.label}</Chip>}
        </div>
      )}
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
        <DetailRow icon={Shapes} label="Subject" muted={unlinked}>
          {unlinked && "Not in your subjects"}
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
      {unlinked && (
        <p className="item-subject-note">
          <BookOpen size={20} aria-hidden="true" />
          <span>{entry.title} isn’t one of your subjects yet. Make it one and its class times, tasks and notes stay together.</span>
        </p>
      )}
      {layer?.note}
    </ItemDetailDialog>
  );
}
