import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Avatar, Button, ConfirmDialog } from "@/shared/ui";
import useProposals from "./useProposals";
import useTimetableEntries from "./useTimetableEntries";
import { proposalLine } from "./classLayer";
import "./proposals.css";

// The Proposals list for the people who can edit a timetable (Figma GW-9, admin 386:4502): each member who changed
// a class for themselves and asked to have it for everyone, with Decline and Approve (confirmed first). A proposal
// whose class changed since (`stale`) says so and can only be declined: the server would refuse an approve.
// Draws nothing when there are none. Mount it only for an editor.
//   scheduleId  the shared timetable
//   stamp       its `updatedAt`: the list is read again when it changes
//   choice      useClassChoice (it answers with a toast, and reads the page again on a 409)
export default function ProposalList({ scheduleId, stamp, choice }) {
  const { proposals, reload } = useProposals(scheduleId, stamp);
  const { entries } = useTimetableEntries(proposals.length ? [scheduleId] : [], stamp);
  const [approving, setApproving] = useState(null);

  const decide = async (send) => {
    await send();
    // Whatever the answer was, the list is read again: a 409 means someone else closed it or the class moved.
    reload();
  };

  const approve = async () => {
    await decide(() => choice.approve(scheduleId, approving));
    setApproving(null);
  };

  if (proposals.length === 0) return null;
  return (
    <section className="proposals" aria-labelledby="proposals-title">
      <header className="proposals__head">
        <h3 id="proposals-title" className="proposals__title">Proposals</h3>
        <p className="proposals__sub">Members who changed a class for themselves and asked you to use it for everyone.</p>
      </header>
      <ul className="proposals__list">
        {proposals.map((proposal) => (
          <li key={proposal._id} className="proposal">
            <div className="proposal__top">
              <Avatar name={proposal.proposer.name} />
              <div className="proposal__text">
                <p className="proposal__who">{proposal.proposer.name} proposes</p>
                <p className="proposal__line">{proposalLine(proposal, entries.get(proposal.entry))}</p>
              </div>
              {proposal.stale && <span className="proposal__stale">Changed since</span>}
            </div>
            {proposal.stale && (
              <p className="proposal__note" role="status">
                <AlertTriangle size={20} aria-hidden="true" />
                This class changed after {proposal.proposer.name} proposed it. Decline it, and ask {proposal.proposer.name} to propose
                again if it still fits.
              </p>
            )}
            <div className="proposal__actions">
              <Button variant="secondary" disabled={choice.busy} onClick={() => decide(() => choice.decline(scheduleId, proposal))}>
                Decline
              </Button>
              {!proposal.stale && (
                <Button icon={Check} disabled={choice.busy} onClick={() => setApproving(proposal)}>
                  Approve
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(approving)}
        sheet
        title={approving ? `Use ${approving.proposer.name}'s time for "${approving.title}"?` : ""}
        confirmLabel="Approve"
        busy={choice.busy}
        onConfirm={approve}
        onCancel={() => setApproving(null)}
      >
        {approving && `It becomes the class for everyone. ${approving.proposer.name}'s own copy is replaced by it, and they are told.`}
      </ConfirmDialog>
    </section>
  );
}
