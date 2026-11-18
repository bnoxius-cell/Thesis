import { Info } from "lucide-react";
import { Button } from "@/shared/ui";
import { noticeText } from "./classLayer";
import "./class-choice.css";

const ACTION_LABELS = { changed: "Use the group's", removed: "Remove mine" };

// The notice on a class the student customized when the shared timetable then changed or removed it (Figma GW-7:
// Plan tab banners 385:2980 and 385:4094, class window 385:3294 and 385:3562). A moved class offers "Use the
// group's" (their own copy goes), a removed one "Remove mine"; "Keep mine" dismisses it either way, and the
// copy stays theirs. Both ask before they act, which is the caller's job.
//   notice   "changed" | "removed"
//   title    the class's name
//   shared   the shared class as it is now, `mine` the student's copy (both optional: they make the line exact)
//   who      "The group" (default) or "The timetable"
//   inline   puts the buttons beside the line from 720px (the Plan tab's banners), not under it (the class window)
//   onResolve  "Use the group's" or "Remove mine"
//   onKeep     "Keep mine"
export default function ChangeNotice({ notice, title, who = "The group", shared, mine, inline = false, busy = false, onResolve, onKeep }) {
  return (
    <div className={`class-notice ${inline ? "class-notice--inline" : ""}`.trim()} role="status">
      <Info size={20} aria-hidden="true" className="class-notice__icon" />
      <p className="class-notice__text">{noticeText(notice, title, who, shared, mine)}</p>
      <div className="class-notice__actions">
        <Button disabled={busy} onClick={onResolve}>{ACTION_LABELS[notice]}</Button>
        <Button variant="secondary" disabled={busy} onClick={onKeep}>Keep mine</Button>
      </div>
    </div>
  );
}
