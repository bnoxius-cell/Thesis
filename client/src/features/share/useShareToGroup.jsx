import { useCallback, useState } from "react";
import ShareToGroupDialog from "./ShareToGroupDialog";

// The "Share to a group" dialog for a page's entry point.
//   const sharing = useShareToGroup();
//   <Button onClick={() => sharing.open("task", task)}>Share</Button>, then render {sharing.dialog} once.
// `kind` is a key of SHARE_KINDS and `item` is what that kind needs (see shareKinds.js). Only offer it for
// items the student owns: the server answers 404 for anyone else's.
export default function useShareToGroup() {
  const [target, setTarget] = useState(null);
  const open = useCallback((kind, item) => setTarget({ kind, item }), []);
  const close = useCallback(() => setTarget(null), []);
  const dialog = target && <ShareToGroupDialog kind={target.kind} item={target.item} onClose={close} />;
  return { open, dialog };
}
