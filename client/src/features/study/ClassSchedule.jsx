import { Clock } from "lucide-react";
import { Card } from "@/shared/ui";
import { lower } from "@/features/plan/entryTime";
import { fromISODate, meetingProvider } from "@/utils/scheduleUtils";

const weekday = (iso) => fromISODate(iso).toLocaleDateString("en-US", { weekday: "short" });

// "Class schedule" (Figma 76:1090): this week's classes from the main timetable, as "Mon 8:00 am ·
// Room 204". Join shows only when the class has a meeting link. "Add meeting link" isn't drawn as a
// working dialog yet, so it doesn't render.
export default function ClassSchedule({ classes }) {
  return (
    <Card as="section" className="subject-card" aria-labelledby="subject-classes-title">
      <h2 id="subject-classes-title" className="subject-card__title">Class schedule</h2>
      {classes.length === 0 ? (
        <p className="subject-card__quiet">No classes for this subject on your timetable this week.</p>
      ) : (
        <ul className="subject-rows">
          {classes.map(({ iso, entry }) => {
            const provider = entry.meetingUrl ? meetingProvider(entry.meetingUrl) : null;
            const when = [`${weekday(iso)} ${lower(entry.startTime)}`, entry.location].filter(Boolean).join(" · ");
            return (
              <li key={`${iso}-${entry._id ?? entry.startTime}`} className="subject-class">
                <Clock size={20} aria-hidden="true" />
                <span className="subject-class__when">{when}</span>
                {entry.meetingUrl && (
                  <a
                    className="ui-btn ui-btn--secondary ui-btn--sm"
                    href={entry.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Join ${entry.title}${provider?.name ? ` on ${provider.name}` : ""}`}
                  >
                    <span>Join</span>
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
