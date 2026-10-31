import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { Button, Modal } from "@/shared/ui";
import { useAuth } from "@/pages/authentication/AuthContext";
import "./legal.css";

const LEGAL_PATHS = ["/terms-of-service", "/privacy-policy"];

// Asks a signed-in student to agree to the current Terms and Privacy Policy. It shows for Google
// sign-ups (email sign-ups agree on the form), for accounts older than the terms, and again whenever
// the server's LEGAL_VERSION is bumped. It can't be dismissed, but the legal pages stay readable.
export default function TermsGate() {
  const { backendUrl, isLoggedin, userData, setUserData, logout } = useAuth();
  const { pathname, search, hash } = useLocation();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const outOfDate = Boolean(
    isLoggedin && userData?.currentLegalVersion && userData.termsVersion !== userData.currentLegalVersion,
  );
  if (!outOfDate || LEGAL_PATHS.includes(pathname)) return null;

  const returning = Boolean(userData.termsVersion);
  const from = pathname + search + hash;

  const accept = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/accept-terms`);
      if (data.success) {
        setUserData((prev) => ({ ...prev, termsVersion: data.termsVersion }));
        toast.success("Thanks, you're all set.");
      } else {
        toast.error(data.message || "Couldn't save that. Please try again.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't save that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      labelledBy="terms-gate-title"
      busy={busy}
      actions={
        <>
          <Button variant="ghost" onClick={() => logout()} disabled={busy}>Log out instead</Button>
          <Button onClick={accept} disabled={!agreed} busy={busy}>
            {busy ? "Saving" : "Agree and continue"}
          </Button>
        </>
      }
    >
      <h2 id="terms-gate-title" className="ui-modal__title">
        {returning ? "We've updated our terms" : "Before you get started"}
      </h2>
      <p>
        {returning
          ? "Our Terms of Service and Privacy Policy changed. Please take a look and agree to keep using StressCare."
          : "StressCare keeps your tasks, schedule and check-in results, so you should know how they're used and who can see them. Your check-ins are never shown to other people."}
      </p>
      <ul className="legal-gate__links">
        <li><Link to="/terms-of-service" state={{ from }}>Terms of Service</Link></li>
        <li><Link to="/privacy-policy" state={{ from }}>Privacy Policy</Link></li>
      </ul>
      <label className="legal-gate__check">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>I've read and agree to the Terms of Service and Privacy Policy.</span>
      </label>
    </Modal>
  );
}
