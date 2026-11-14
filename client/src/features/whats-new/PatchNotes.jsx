import { Chip } from "@/shared/ui";
import { NOTE_TAGS } from "./releaseNotes";
import "./whats-new.css";

const TAG_TONE = { new: "accent", improved: "neutral", fixed: "good" };
// An entry id starts with its release date (YYYY-MM-DD, maybe a "-2" after it): "14 Nov 2026".
export const entryDate = (id) => new Date(`${id.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// One update: its title and date, then its changes grouped under New, Improved and Fixed so a student
// can read the headline first and skim the rest. `latest` marks the newest update.
export default function PatchNotes({ entry, latest = false, headingLevel = "h3" }) {
  const Heading = headingLevel;
  const groups = Object.keys(NOTE_TAGS)
    .map((tag) => ({ tag, items: entry.items.filter((item) => item.tag === tag) }))
    .filter((group) => group.items.length > 0);

  return (
    <article className="patch">
      <header className="patch__head">
        <Heading className="patch__title">{entry.title || "Update"}</Heading>
        <p className="patch__meta">
          <time dateTime={entry.id.slice(0, 10)}>{entryDate(entry.id)}</time>
          {latest && <Chip tone="accent">Latest</Chip>}
        </p>
      </header>
      {groups.map(({ tag, items }) => (
        <section key={tag} className="patch__group" aria-label={NOTE_TAGS[tag]}>
          <Chip tone={TAG_TONE[tag]}>{NOTE_TAGS[tag]}</Chip>
          <ul className="patch__items">
            {items.map((item) => <li key={item.text}>{item.text}</li>)}
          </ul>
        </section>
      ))}
    </article>
  );
}
