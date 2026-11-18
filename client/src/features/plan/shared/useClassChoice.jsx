import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { ConfirmDialog } from "@/shared/ui";
import {
  chooseClass,
  customizeAllClasses,
  customizeClass,
  keepMyClass,
  publishMyClass,
  proposeMyClass,
  approveProposal,
  declineProposal,
  withdrawProposal,
} from "@/shared/api/schedules";

// The three choices that delete the student's own copy of a class, so each is confirmed first. Each says which
// choice it sends, and its words.
const CONFIRMS = {
  use: {
    choice: "follow",
    title: (name) => `Use the group's ${name}?`,
    body: "Your own copy is deleted from your timetable and the class follows the group again. This can't be undone.",
    label: "Use the group's",
    done: (name) => `Using the group's ${name} again.`,
  },
  remove: {
    choice: "follow",
    title: (name) => `Remove your copy of ${name}?`,
    body: "The group removed this class. Your copy is deleted from your timetable. This can't be undone.",
    label: "Remove mine",
    done: (name) => `Removed your copy of ${name}.`,
  },
  drop: {
    choice: "hidden",
    title: (name) => `Stop taking ${name}?`,
    body: "Your own copy is deleted from your timetable and the class leaves your week. This can't be undone.",
    label: "Not taking this",
    done: (name) => `${name} is out of your week.`,
  },
};

const quoted = (ref) => `"${ref.title}"`;

// The student's choices on the classes of a timetable shared with them, ready to wire to buttons.
//   const choice = useClassChoice({ onChanged }); render {choice.dialog} once.
// `ref` is `{ scheduleId, entryId, title }` of the shared class (layerRef gives it). Every call shows a plain
// toast, then runs `onChanged` so the page reads its week again (the server works out what the week looks like
// now: nothing is resolved here), and resolves to the server's answer, or to null after showing the error. The
// ones that delete the student's copy (`ask`) open a confirm first and run `done` after it went through.
//   choose(ref, "follow" | "hidden")   "I take this" and "Not taking this"
//   ask("use" | "remove" | "drop", ref, done)   delete the copy, after a confirm
//   customize(ref)                     their own copy: { scheduleId, entryId } (the same copy again on a retry)
//   customizeAll(scheduleId)           a copy of every class they follow
//   keepMine(ref), publish(ref)        keep their version; make it the class for everyone (editors)
//   propose(ref), withdraw(ref, proposal)       a member's proposal of their copy's time to the admins, and taking it back
//   approve(scheduleId, proposal), decline(...)  editors decide a proposal (the caller confirms an approve first)
//   busy                               a call is running
export default function useClassChoice({ onChanged }) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(null); // { kind, ref, done }

  const apply = useCallback(
    async (send, message) => {
      setBusy(true);
      const { data, error, status } = await send();
      setBusy(false);
      if (error) {
        toast.error(error);
        // "Changed since" and "already closed": the page's week is out of date, so read it again.
        if (status === 409) onChanged();
        return null;
      }
      if (message) toast.success(typeof message === "function" ? message(data) : message);
      onChanged();
      return data;
    },
    [onChanged],
  );

  const choose = (ref, choice) =>
    apply(
      () => chooseClass(ref.scheduleId, ref.entryId, choice),
      choice === "hidden" ? `${quoted(ref)} is out of your week.` : `${quoted(ref)} is back in your week.`,
    );

  const customize = (ref) => apply(() => customizeClass(ref.scheduleId, ref.entryId));

  const customizeAll = (scheduleId) =>
    apply(
      () => customizeAllClasses(scheduleId),
      ({ customized }) => (customized ? `Copied ${customized} ${customized === 1 ? "class" : "classes"} to your timetable.` : "Every class is already yours."),
    );

  const keepMine = (ref) => apply(() => keepMyClass(ref.scheduleId, ref.entryId), `Kept your version of ${quoted(ref)}.`);

  const publish = (ref) =>
    apply(() => publishMyClass(ref.scheduleId, ref.entryId), `Your version of ${quoted(ref)} is now the class for everyone.`);

  const propose = (ref) =>
    apply(() => proposeMyClass(ref.scheduleId, ref.entryId), `Your time for ${quoted(ref)} was sent to the admins.`);

  const withdraw = (ref, proposal) => apply(() => withdrawProposal(ref.scheduleId, proposal._id), "Proposal taken back.");

  const approve = (scheduleId, proposal) =>
    apply(() => approveProposal(scheduleId, proposal._id), `${proposal.proposer.name}'s time is now the class for everyone.`);

  const decline = (scheduleId, proposal) =>
    apply(() => declineProposal(scheduleId, proposal._id), `Declined ${proposal.proposer.name}'s change to "${proposal.title}".`);

  const ask = (kind, ref, done) => setAsking({ kind, ref, done });

  const confirm = async () => {
    const { kind, ref, done } = asking;
    const { choice, done: message } = CONFIRMS[kind];
    const saved = await apply(() => chooseClass(ref.scheduleId, ref.entryId, choice), message(quoted(ref)));
    if (!saved) return;
    setAsking(null);
    done?.();
  };

  const words = asking && CONFIRMS[asking.kind];
  const dialog = (
    <ConfirmDialog
      open={Boolean(asking)}
      sheet
      tone="danger"
      title={words?.title(quoted(asking.ref)) ?? ""}
      confirmLabel={words?.label}
      busy={busy}
      onConfirm={confirm}
      onCancel={() => setAsking(null)}
    >
      {words?.body}
    </ConfirmDialog>
  );

  return { choose, ask, customize, customizeAll, keepMine, publish, propose, withdraw, approve, decline, busy, dialog };
}
