import { useState } from "react";
import { toast } from "react-toastify";
import { Clock, CalendarDays, MapPin, Video, StickyNote, BookOpen, Copy } from "lucide-react";
import {
  WEEKDAYS, ENTRY_ICONS, KIND_LABELS, formatTime, formatLongDate, defaultIconFor, meetingProvider,
} from "../../utils/scheduleUtils";
import JoinLink from "./JoinLink";

const whenText = (entry) => {
  if (entry.date) return formatLongDate(entry.date);
  const days = WEEKDAYS.filter((d) => entry.days.includes(d.value)).map((d) => d.long);
  const range = [entry.startDate && `from ${formatLongDate(entry.startDate)}`, entry.endDate && `until ${formatLongDate(entry.endDate)}`]
    .filter(Boolean).join(" ");
  return `Every ${days.join(", ")}${range ? `, ${range}` : ""}`;
};

// Read-only look at one entry, for people who can view the schedule but not edit it.
export default function EntryDetails({ entry, onClose }) {
  const [copied, setCopied] = useState(false);
  const Icon = ENTRY_ICONS[entry.icon] || ENTRY_ICONS[defaultIconFor(entry.kind)];
  const provider = entry.meetingUrl ? meetingProvider(entry.meetingUrl) : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(entry.meetingUrl);
      setCopied(true);
      toast.success("Link copied.");
    } catch {
      toast.info(entry.meetingUrl);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content sched-modal sched-modal-narrow sched-details" role="dialog" aria-modal="true" aria-labelledby="entry-details-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="sched-details-head" style={entry.color ? { "--entry-color": entry.color } : undefined}>
            <span className="sched-thumb sched-thumb-lg">
              {entry.image ? <img src={entry.image} alt="" /> : <Icon size={26} aria-hidden="true" />}
            </span>
            <div>
              <span className="panel-kicker">{KIND_LABELS[entry.kind]}</span>
              <h2 id="entry-details-title">{entry.title}</h2>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <ul className="sched-details-list">
          <li><Clock size={16} aria-hidden="true" /> {formatTime(entry.startTime)} to {formatTime(entry.endTime)}</li>
          <li><CalendarDays size={16} aria-hidden="true" /> {whenText(entry)}</li>
          {entry.location && <li><MapPin size={16} aria-hidden="true" /> {entry.location}</li>}
          {entry.kind === "exam" && entry.prepHours > 0 && <li><BookOpen size={16} aria-hidden="true" /> {entry.prepHours} hours of study set aside</li>}
          {entry.notes && <li><StickyNote size={16} aria-hidden="true" /> {entry.notes}</li>}
          {entry.meetingUrl && (
            <li className="sched-details-meeting">
              <Video size={16} aria-hidden="true" />
              <span>
                Online on {provider?.name || "a meeting link"}
                <span className="sched-details-meeting-actions">
                  <JoinLink url={entry.meetingUrl} className="primary-button small" />
                  <button type="button" className="secondary-button small" onClick={copyLink}>
                    <Copy size={14} aria-hidden="true" /> {copied ? "Copied" : "Copy link"}
                  </button>
                </span>
              </span>
            </li>
          )}
        </ul>
        {entry.skipOnHoliday && <p className="sched-hint">Skipped on holidays and days off.</p>}

        <div className="modal-actions sched-modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
