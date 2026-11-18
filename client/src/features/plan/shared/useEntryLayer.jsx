import { Send } from "lucide-react";
import { Button } from "@/shared/ui";
import { kindName } from "@/features/details/detailText";
import ChangeNotice from "./ChangeNotice";
import ClassChoiceMenu from "./ClassChoiceMenu";
import ProposalNote from "./ProposalNote";
import { layerChip, layerRef, proposalText } from "./classLayer";
import useProposals from "./useProposals";
import useTimetableEntries from "./useTimetableEntries";

const CAN_PUBLISH = ["owner", "editor"];

// What the details window adds for a class of a timetable shared with the student (Figma GW-6, GW-7, GW-8), as
// pieces for its footer and body; null for any other entry, and when the page gave no `choice`.
//   chip     "Follows the group", "Not taking" or "Yours"
//   notice   the change notice, when the student's copy was moved or removed by the shared timetable
//   isCopy   the entry is the student's own copy (their week shows copies, the shared timetable shows the class)
//   start    the footer's left slot: Class options on the shared class, "Use the group's" on a copy with no notice
//   publish  "Publish my version", for an editor of the shared timetable on their own copy
//   propose  "Propose this time to the admins" for anyone else on their own copy, then "Withdraw" while it is open
//   proposalChip, note  the chip ("Sent to the admins") and the line about proposing (Figma GW-9, 386:4421)
// Every action closes the window once the server took it, so it never shows a stale entry: the page reads its
// week again (`choice`'s `onChanged`). `handlers` are the window's `{ close }`, handed on to Edit and Delete.
export default function useEntryLayer({ entry, choice, handlers, onEdit, onDelete }) {
  const layer = choice ? layerRef(entry) : null;
  // A copy needs the shared class (to say what moved) and the student's role on it (to offer Publish).
  const { entries, roles } = useTimetableEntries(layer?.isCopy ? [layer.scheduleId] : []);
  // A student who can't edit the shared timetable can propose the time of their copy, unless the class moved
  // under it (the server would refuse: they keep or drop the copy first).
  const canPropose = Boolean(layer?.isCopy) && !layer.notice && roles.get(layer.scheduleId) === "viewer";
  const { proposals, reload: reloadProposals } = useProposals(canPropose ? layer.scheduleId : "");
  if (!layer) return null;

  const { close } = handlers;
  const closeAfter = async (answer) => {
    if (await answer) close();
  };

  const customize = async () => {
    const made = await choice.customize(layer);
    if (!made) return;
    // Their copy opens in the edit dialog, over the window; without an Edit the window just closes.
    if (!onEdit) return close();
    const copy = { ...entry, scheduleId: made.scheduleId, entryId: made.entryId, myChoice: "custom", canEdit: true };
    onEdit({ ...copy, customOf: { scheduleId: layer.scheduleId, entryId: layer.entryId } }, handlers);
  };

  // Giving up a copy of their own is confirmed; every other change of mind is not.
  const pick = (next, confirmKind) => () => {
    if (layer.choice === next) return;
    if (layer.choice === "custom") choice.ask(confirmKind, layer, close);
    else closeAfter(choice.choose(layer, next));
  };

  const actions = {
    follow: pick("follow", "use"),
    hidden: pick("hidden", "drop"),
    customize,
    all: () => closeAfter(choice.customizeAll(layer.scheduleId)),
    ...(entry.canEdit && onEdit && { edit: () => onEdit(entry, handlers) }),
    ...(entry.canEdit && onDelete && { delete: () => onDelete(entry, handlers) }),
  };

  const shared = entries.get(layer.entryId);
  const canPublish = layer.isCopy && layer.notice !== "removed" && CAN_PUBLISH.includes(roles.get(layer.scheduleId));
  let start;
  if (!layer.isCopy) {
    start = <ClassChoiceMenu layer={layer} subtitle={`${kindName(entry.kind)} · ${entry.scheduleTitle}`} actions={actions} busy={choice.busy} />;
  } else if (!layer.notice) {
    start = (
      <Button variant="ghost" className="item-footer__options" disabled={choice.busy} onClick={actions.follow}>
        Use the group's
      </Button>
    );
  }

  const proposal = canPropose ? proposals.find((item) => item.entry === layer.entryId) : null;
  const afterProposal = async (answer) => {
    if (await answer) reloadProposals();
  };
  let propose = false;
  if (canPropose) {
    propose = proposal ? (
      <Button variant="secondary" disabled={choice.busy} onClick={() => afterProposal(choice.withdraw(layer, proposal))}>
        Withdraw
      </Button>
    ) : (
      <Button icon={Send} className="item-footer__propose" disabled={choice.busy} onClick={() => afterProposal(choice.propose(layer))}>
        Propose this time to the admins
      </Button>
    );
  }

  return {
    chip: layerChip(entry),
    isCopy: layer.isCopy,
    start,
    notice: layer.notice && (
      <ChangeNotice
        notice={layer.notice}
        title={entry.title}
        who={layer.group ? "The group" : "The timetable"}
        shared={shared}
        mine={entry}
        busy={choice.busy}
        onResolve={() => choice.ask(layer.notice === "changed" ? "use" : "remove", layer, close)}
        onKeep={() => closeAfter(choice.keepMine(layer))}
      />
    ),
    propose,
    proposalChip: proposal && { label: "Sent to the admins", tone: "accent" },
    note: canPropose && <ProposalNote>{proposalText(proposal, shared, entry, layer.group ? "the group" : "the timetable")}</ProposalNote>,
    publish: canPublish && (
      <Button disabled={choice.busy} onClick={() => closeAfter(choice.publish(layer))}>
        Publish my version
      </Button>
    ),
  };
}
