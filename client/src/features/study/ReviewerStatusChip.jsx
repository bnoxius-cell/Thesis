import { Chip } from "@/shared/ui";
import { reviewerChip } from "./reviewerStatus";
import "./reviewer-chip.css";

// One reviewer's status as a chip. It is keyed by its label, so when "Making it" turns into its
// final state the chip is replaced and settles in.
export default function ReviewerStatusChip({ reviewer }) {
  const chip = reviewerChip(reviewer);
  return (
    <Chip
      key={chip.label}
      tone={chip.tone}
      className={chip.busy ? "study-chip study-chip--busy" : "study-chip"}
      role={chip.busy ? "status" : undefined}
    >
      {chip.label}
    </Chip>
  );
}
