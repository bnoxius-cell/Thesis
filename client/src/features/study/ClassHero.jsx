import { ChevronRight, Clock, Flag, Link2, MapPin, Video } from "lucide-react";
import { Button } from "@/shared/ui";
import JoinLink from "@/features/plan/JoinLink";
import { lower, timeRangeText } from "@/features/plan/entryTime";
import { repeatText } from "@/features/details/itemLinks";
import { SUBJECT_COLORS } from "@/utils/subjectColors";
import { fromISODate, meetingProvider } from "@/utils/scheduleUtils";
import { SOON_MINUTES, dayWord, examLine, heroState, inText, whereText } from "@/utils/classHero";

const lowerFirst = (text) => (text ? text[0].toLowerCase() + text.slice(1) : "");
const examWhen = (days) => (days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);

// "Midterm in 6 days · Fri 1:00 pm" (no weekday for an exam today).
function examText({ label, days, iso, entry }) {
  const weekday = days > 0 ? `${fromISODate(iso).toLocaleDateString("en-US", { weekday: "short" })} ` : "";
  return `${label} ${examWhen(days)} · ${weekday}${lower(entry.startTime)}`;
}

// What the hero says for each state: the eyebrow and its tone, the big line, the small line under it as
// [icon, parts] (the parts are joined with a dot, empty ones dropped) and whether to note a saved meeting link.
// `time` is the class time the class comes from (it says whether the class lives on another timetable).
function wordsFor(hero, time, subject, canAdd, now) {
  if (hero.state === "none") {
    return {
      title: `When does ${subject.name} meet?`,
      note: canAdd ? "Add its class times. They show here, on Plan and in your week." : "It has no class times.",
    };
  }
  if (hero.state === "idle") return { eyebrow: "NEXT CLASS", tone: "quiet", title: "No class in the next two weeks" };

  const { entry } = hero;
  const room = entry.location;
  const where = time ? lowerFirst(whereText(time)) : "";
  const hours = timeRangeText(entry.startTime, entry.endTime);
  const linked = Boolean(entry.meetingUrl && meetingProvider(entry.meetingUrl));
  const repeat = repeatText(entry.days);

  if (hero.state === "now") {
    const left = `${hero.minutesLeft} min left`;
    if (linked) {
      return { eyebrow: "ON NOW", tone: "good", live: true, title: `Until ${lower(entry.endTime)} · ${left}`, meta: [MapPin, [room, repeat, where]] };
    }
    return {
      eyebrow: "ON NOW",
      tone: "good",
      live: true,
      title: room ? `In ${room} until ${lower(entry.endTime)}` : `Until ${lower(entry.endTime)}`,
      meta: [Clock, [left, "no meeting link for this class", where]],
    };
  }
  if (hero.state === "soon") {
    return { eyebrow: `STARTS IN ${hero.minutesUntil} MIN`, tone: "accent", title: hours, meta: [MapPin, [room, repeat, where]] };
  }
  return {
    eyebrow: "NEXT CLASS",
    tone: "quiet",
    title: `${dayWord(hero.iso, now)}, ${hours}`,
    meta: [MapPin, [room, inText(hero), where]],
    savedLink: linked,
  };
}

// The hero at the top of a subject's Overview (Figma OV-F1 to OV-F8): one state at a time. On now and Starts soon
// carry the big Join when the class has a meeting link; Next says when and where; with no class times it asks
// when the subject meets. An exam within two weeks adds a line that opens the exam's details. `onOpen(entry, iso)`
// opens the details window. It moves on by itself as `now` (useNow, every minute) does, and cross-fades when the
// state changes (the body is keyed on it).
export default function ClassHero({ subject, classTimes, upcoming, now, canAdd, onAdd, onOpen }) {
  const hero = heroState(classTimes, upcoming, now);
  const exam = examLine(upcoming, subject, now);
  const tint = SUBJECT_COLORS.includes(subject.color) ? subject.color : "blue";
  const { entry } = hero;
  const time = entry && classTimes.find((item) => item.entryId === entry.entryId);
  const words = wordsFor(hero, time, subject, canAdd, now);
  const [MetaIcon, metaParts] = words.meta ?? [];
  const meta = (metaParts ?? []).filter(Boolean).join(" · ");
  const provider = entry?.meetingUrl && meetingProvider(entry.meetingUrl);
  const showJoin = provider && (hero.state === "now" || hero.state === "soon");

  return (
    <section
      className={`class-hero class-hero--${hero.state}`}
      style={{ "--hero-tint": `var(--subject-${tint}-soft)` }}
      aria-labelledby="class-hero-title"
    >
      <div key={hero.state} className="class-hero__body">
        <div className="class-hero__text">
          {words.eyebrow && (
            <p className={`class-hero__eyebrow class-hero__eyebrow--${words.tone}`}>
              {words.live && <span className="class-hero__dot" aria-hidden="true" />}
              {words.eyebrow}
            </p>
          )}
          <h2 id="class-hero-title" className="class-hero__title">{words.title}</h2>
          {words.note && <p className="class-hero__meta">{words.note}</p>}
          {meta && (
            <p className="class-hero__meta">
              <MetaIcon size={16} aria-hidden="true" />
              <span>{meta}</span>
            </p>
          )}
          {words.savedLink && (
            <p className="class-hero__meta">
              <Link2 size={16} aria-hidden="true" />
              <span>Meeting link saved. Join shows {SOON_MINUTES} min before class.</span>
            </p>
          )}
          {exam && (
            <button type="button" className="ui-chip ui-chip--watch class-hero__exam" aria-haspopup="dialog" onClick={() => onOpen(exam.entry, exam.iso)}>
              <Flag size={14} aria-hidden="true" />
              <span>{examText(exam)}</span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        {hero.state === "none" && canAdd && (
          <div className="class-hero__actions">
            <Button onClick={onAdd}>Add class time</Button>
          </div>
        )}
        {entry && (
          <div className="class-hero__actions">
            <Button variant="secondary" className="class-hero__details" aria-haspopup="dialog" onClick={() => onOpen(entry, hero.iso)}>
              Details
            </Button>
            {showJoin && (
              <JoinLink
                entry={{ title: subject.name, meetingUrl: entry.meetingUrl }}
                variant="primary"
                size="md"
                icon={Video}
                label={`Join on ${provider.name}`}
                className="class-hero__join"
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
