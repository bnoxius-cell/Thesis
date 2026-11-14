import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/shared/ui";
import Page from "@/app/shell/Page";
import PatchNotes from "./PatchNotes";
import { RELEASE_NOTES } from "./releaseNotes";
import useWhatsNew from "./useWhatsNew";
import "./whats-new.css";

// Every update, newest first, one block per patch. Opening it counts as seeing the latest update.
export default function WhatsNewPage() {
  const { markSeen, hasUnseen } = useWhatsNew();

  useEffect(() => {
    if (hasUnseen) markSeen();
  }, [hasUnseen, markSeen]);

  return (
    <Page title="What's new" subtitle="Every update to StressCare, newest first." back={{ to: "/home", label: "Back to Home" }}>
      {RELEASE_NOTES.length === 0 ? (
        <EmptyState icon={Sparkles} title="Nothing here yet">Updates will show up here.</EmptyState>
      ) : (
        <div className="patch-list">
          {RELEASE_NOTES.map((entry, i) => (
            <PatchNotes key={entry.id} entry={entry} latest={i === 0} headingLevel="h2" />
          ))}
        </div>
      )}
    </Page>
  );
}
