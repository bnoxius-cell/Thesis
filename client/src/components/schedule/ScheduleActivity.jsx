import { History, Users } from "lucide-react";

const timeAgo = (iso) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
};

// Shown on a schedule more than one person can edit: who is on it, and the latest changes with
// the name of whoever made each one, so nobody is surprised by a time that moved.
export default function ScheduleActivity({ schedule }) {
  const editors = [schedule.owner, ...schedule.collaborators.map((c) => c.user)].filter(Boolean);
  const recent = [...(schedule.activity || [])].reverse().slice(0, 12);

  return (
    <section className="panel sched-activity" aria-labelledby="sched-activity-heading">
      <div className="sched-activity-head">
        <div>
          <span className="panel-kicker"><History size={16} aria-hidden="true" /> Recent changes</span>
          <h2 id="sched-activity-heading">What changed</h2>
        </div>
        <p className="sched-activity-people">
          <Users size={16} aria-hidden="true" />
          <span>Edited by {editors.map((p) => p.name).join(", ")}</span>
        </p>
      </div>

      {recent.length === 0 ? (
        <p className="schedule-empty">No changes yet. When someone adds, edits or removes something, it shows up here.</p>
      ) : (
        <ul className="sched-activity-list">
          {recent.map((item) => (
            <li key={item._id}>
              <span><strong>{item.userName || "Someone"}</strong> {item.summary}</span>
              <time dateTime={item.at}>{timeAgo(item.at)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
