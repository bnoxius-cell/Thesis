import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Pin } from "lucide-react";
import { toast } from "react-toastify";
import { Button, ConfirmDialog, Modal, Segment } from "@/shared/ui";
import { useAuth } from "@/pages/authentication/AuthContext";
import { addAdmin, deleteGroup, leaveGroup, removeAdmin, removeMember, updateGroup } from "@/shared/api/groups";
import GroupMemberRow, { MEMBER_ICONS } from "./GroupMemberRow";
import GroupTextDialog from "./GroupTextDialog";
import useGroupInfo from "./useGroupInfo";
import "./people-info.css";

const SHOWN = 4; // members listed before "Show all"
const LEVELS = [
  { value: "all", label: "All messages" },
  { value: "tasks", label: "Tasks only" },
  { value: "muted", label: "Muted" },
];
const ROLES = ["owner", "admin", "member"];
const ROWS = [
  { key: "name", label: "Edit group name", icon: Pencil },
  { key: "note", label: "Pin a note", icon: Pin },
];
const MONTH_DAY = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

const same = (a, b) => String(a) === String(b);

// The group's Info dialog (Figma 64:910): members, the join code, this student's notification level,
// and for admins Edit group name and Pin a note. Leave group sits bottom left (the owner deletes the
// group instead). `onChanged` refreshes the group list; `onGone` runs after the student has left or
// the group is deleted. The server checks every admin action again, so hiding them is only tidiness.
export default function GroupInfoDialog({ group, onClose, onChanged, onGone }) {
  const myId = useAuth().userData?._id;
  const { level, changeLevel, busy, run } = useGroupInfo(group._id, onChanged);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(null); // "name" | "note" | null
  const [asking, setAsking] = useState(false);

  const ownerId = group.admin?._id;
  const isOwner = same(ownerId, myId);
  const isAdmin = isOwner || (group.admins ?? []).some((id) => same(id, myId));

  // 0 owner, 1 admin, 2 member. Listed in that order, then the server's order.
  const rank = (person) => {
    if (same(person._id, ownerId)) return 0;
    return (group.admins ?? []).some((id) => same(id, person._id)) ? 1 : 2;
  };
  const members = [...group.members].sort((a, b) => rank(a) - rank(b));
  const listed = showAll ? members : members.slice(0, SHOWN);
  const count = members.length;

  // The owner can promote, demote and remove anyone else; an admin can remove regular members only.
  const actionsFor = (person) => {
    const r = rank(person);
    if (r === 0 || same(person._id, myId)) return [];
    const list = [];
    if (isOwner) {
      list.push(
        r === 1
          ? { key: "demote", label: "Remove as admin", icon: MEMBER_ICONS.demote, run: () => run(() => removeAdmin(group._id, person._id), "Admin removed.") }
          : { key: "promote", label: "Make admin", icon: MEMBER_ICONS.promote, run: () => run(() => addAdmin(group._id, person._id), "They're an admin now.") },
      );
    }
    if (isAdmin && (r === 2 || isOwner)) {
      list.push({ key: "remove", label: "Remove from group", icon: MEMBER_ICONS.remove, danger: true, run: () => run(() => removeMember(group._id, person._id), "Member removed.") });
    }
    return list;
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(group.joinCode);
      toast.success("Join code copied.");
    } catch {
      toast.error("Couldn't copy that. Select the code and copy it by hand.");
    }
  };

  const save = (fields) => run(() => updateGroup(group._id, fields), "Saved.");

  const leave = async () => {
    const call = isOwner ? deleteGroup : leaveGroup;
    if (await run(() => call(group._id))) onGone();
  };

  const created = group.createdAt ? `Created ${MONTH_DAY.format(new Date(group.createdAt))} · ` : "";

  return (
    <>
      <Modal
        title={group.name}
        subtitle={`${created}${count} ${count === 1 ? "member" : "members"}`}
        className="people-info"
        onClose={onClose}
        busy={busy}
        actions={
          <>
            <Button variant="danger" onClick={() => setAsking(true)} disabled={busy}>
              {isOwner ? "Delete group" : "Leave group"}
            </Button>
            <Button onClick={onClose} disabled={busy}>
              Done
            </Button>
          </>
        }
      >
        <section aria-labelledby="people-info-members">
          <p className="people-eyebrow" id="people-info-members">
            Members · {count}
          </p>
          <ul className="people-info__members">
            {listed.map((person) => (
              <GroupMemberRow
                key={person._id}
                person={person}
                isMe={same(person._id, myId)}
                role={ROLES[rank(person)]}
                actions={actionsFor(person)}
              />
            ))}
          </ul>
          {count > SHOWN && (
            <button type="button" className="people-info__more" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `Show all ${count} members`}
              <ChevronDown size={20} aria-hidden="true" data-open={showAll || undefined} />
            </button>
          )}
        </section>

        {group.joinCode && (
          <div className="people-info__code">
            <div>
              <p className="people-eyebrow">Join code</p>
              <p className="people-info__code-value">{group.joinCode}</p>
            </div>
            <Button variant="secondary" onClick={copyCode} aria-label={`Copy join code ${group.joinCode}`}>
              Copy
            </Button>
          </div>
        )}

        <section className="people-info__notify">
          <p className="people-eyebrow" id="people-info-notify">
            Notifications for this group
          </p>
          <Segment options={LEVELS} value={level} onChange={changeLevel} labelId="people-info-notify" disabled={level === null || busy} />
          <p className="people-info__hint">Overrides your account setting for this group only.</p>
        </section>

        {isAdmin && (
          <ul className="people-info__rows">
            {ROWS.map(({ key, label, icon: Icon }) => (
              <li key={key}>
                <button type="button" className="people-info__row" onClick={() => setEditing(key)}>
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {editing === "name" && (
        <GroupTextDialog
          title="Edit group name"
          label="Group name"
          initial={group.name}
          maxLength={60}
          busy={busy}
          onSave={(name) => save({ name })}
          onClose={() => setEditing(null)}
        />
      )}
      {editing === "note" && (
        <GroupTextDialog
          title="Pin a note"
          label="Note for the group"
          hint="Everyone sees it at the top of the chat. Leave it empty to remove the note."
          initial={group.pinned?.text ?? ""}
          maxLength={280}
          multiline
          allowEmpty
          busy={busy}
          onSave={(pinned) => save({ pinned })}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={asking}
        title={isOwner ? "Delete this group?" : "Leave this group?"}
        confirmLabel={isOwner ? "Delete group" : "Leave group"}
        tone="danger"
        busy={busy}
        onConfirm={leave}
        onCancel={() => setAsking(false)}
      >
        <p>
          {isOwner
            ? `${group.name} and its chat go for everyone in it. This can't be undone.`
            : `You'll stop getting ${group.name}'s messages. You can join again with its code.`}
        </p>
      </ConfirmDialog>
    </>
  );
}
