import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button, ConfirmDialog, IconButton, Menu, MenuItem } from "@/shared/ui";

// The inbox's two actions: Mark all read (off when nothing is unread) and a More menu holding Clear all,
// which asks first. There is no per-row delete on purpose.
export default function InboxActions({ inbox }) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const empty = inbox.items.length === 0;
  const nothingUnread = !inbox.items.some((n) => !n.isRead);

  const clear = async () => {
    setClearing(true);
    await inbox.clearAll();
    setClearing(false);
    setConfirming(false);
  };

  return (
    <>
      <Button variant="ghost" size="sm" disabled={nothingUnread} onClick={inbox.markAll}>
        Mark all read
      </Button>
      <Menu
        align="end"
        label="More"
        trigger={(props) => <IconButton plain icon={MoreHorizontal} label="More" {...props} />}
      >
        <MenuItem icon={Trash2} tone="danger" disabled={empty} onSelect={() => setConfirming(true)}>
          Clear all
        </MenuItem>
      </Menu>
      <ConfirmDialog
        open={confirming}
        title="Clear all notifications?"
        tone="danger"
        confirmLabel="Clear all"
        cancelLabel="Keep them"
        busy={clearing}
        sheet
        onConfirm={clear}
        onCancel={() => setConfirming(false)}
      >
        This removes everything in your inbox. It can't be undone.
      </ConfirmDialog>
    </>
  );
}
