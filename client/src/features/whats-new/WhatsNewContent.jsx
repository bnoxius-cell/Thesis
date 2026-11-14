import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/shared/ui";
import PatchNotes from "./PatchNotes";
import { RELEASE_NOTES } from "./releaseNotes";
import useWhatsNew from "./useWhatsNew";
import "./whats-new.css";

// Every update, newest first, one block per patch. Showing it counts as seeing the latest update.
// It is the What's new tab of Settings (/settings/whats-new).
export default function WhatsNewContent() {
  const { markSeen, hasUnseen } = useWhatsNew();

  useEffect(() => {
    if (hasUnseen) markSeen();
  }, [hasUnseen, markSeen]);

  if (RELEASE_NOTES.length === 0) {
    return <EmptyState icon={Sparkles} title="Nothing here yet">Updates will show up here.</EmptyState>;
  }
  return (
    <div className="patch-list">
      {RELEASE_NOTES.map((entry, i) => (
        <PatchNotes key={entry.id} entry={entry} latest={i === 0} headingLevel="h2" />
      ))}
    </div>
  );
}
