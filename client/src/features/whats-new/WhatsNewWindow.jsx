import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { Button, Modal } from "@/shared/ui";
import { openDialogCount, subscribeOpenDialogs } from "@/shared/ui/ModalShell";
import { useAuth } from "@/pages/authentication/AuthContext";
import PatchNotes from "./PatchNotes";
import useWhatsNew from "./useWhatsNew";
import "./whats-new.css";

const SETTLE_MS = 1200;
const AFTER_DIALOG_MS = 1500;
const MAX_ENTRIES = 3;

// A one-time "What's new" window after an update. It never interrupts: it waits for the legal gate,
// for any open dialog, and for the page to settle. Any way of closing it marks the update seen.
// Mounted once in AppLayout, so check-ins, Practice runs and public pages never get it.
export default function WhatsNewWindow() {
  const { isLoggedin, userData } = useAuth();
  const { unseen, hasUnseen, markSeen } = useWhatsNew();
  const { pathname } = useLocation();
  const dialogs = useSyncExternalStore(subscribeOpenDialogs, openDialogCount);
  const [shown, setShown] = useState(null);
  const sawDialog = useRef(false);
  const gotItRef = useRef(null);

  const termsAgreed = userData?.termsVersion === userData?.currentLegalVersion;
  const ready = Boolean(isLoggedin && userData && termsAgreed && hasUnseen && !shown);

  useEffect(() => {
    if (dialogs > 0) sawDialog.current = true;
    if (!ready || dialogs > 0) return undefined;
    const timer = setTimeout(() => {
      if (openDialogCount() === 0) setShown(unseen);
    }, sawDialog.current ? AFTER_DIALOG_MS : SETTLE_MS);
    return () => clearTimeout(timer);
  }, [ready, dialogs, pathname, unseen]);

  if (!shown) return null;

  const close = () => {
    setShown(null);
    markSeen();
  };
  const entries = shown.slice(0, MAX_ENTRIES);

  return (
    <Modal
      title="What's new"
      subtitle="Here's what changed since you were last here."
      sheet
      className="whats-new"
      initialFocusRef={gotItRef}
      onClose={close}
      actions={(
        <>
          <Button variant="secondary" to="/whats-new" onClick={close}>See all updates</Button>
          <Button ref={gotItRef} onClick={close}>Got it</Button>
        </>
      )}
    >
      {entries.map((entry, i) => <PatchNotes key={entry.id} entry={entry} latest={i === 0} />)}
      {shown.length > MAX_ENTRIES && <p className="whats-new__more">Older updates are under See all updates.</p>}
    </Modal>
  );
}
