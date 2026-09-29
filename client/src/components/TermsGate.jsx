import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../pages/authentication/AuthContext";

// Asks a signed-in user to agree to the current Terms of Service and Privacy Policy.
// It shows for brand-new accounts that came in through Google (email sign-ups agree on
// the form), for accounts that existed before the terms did, and again whenever the
// server's LEGAL_VERSION is bumped. The legal pages themselves stay readable.
export default function TermsGate() {
  const { backendUrl, isLoggedin, userData, setUserData, logout } = useAuth();
  const location = useLocation();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const onLegalPage = location.pathname === "/terms-of-service" || location.pathname === "/privacy-policy";
  const outOfDate = Boolean(
    isLoggedin && userData?.currentLegalVersion && userData.termsVersion !== userData.currentLegalVersion
  );
  if (!outOfDate || onLegalPage) return null;

  const returning = Boolean(userData.termsVersion);
  const from = location.pathname + location.search;

  const accept = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/accept-terms`, {}, { withCredentials: true });
      if (data.success) {
        setUserData((prev) => ({ ...prev, termsVersion: data.termsVersion }));
        toast.success("Thanks. You're all set.");
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
    <div className="modal-overlay terms-gate-overlay">
      <div className="terms-gate" role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
        <span className="terms-gate-icon" aria-hidden="true"><ShieldCheck size={26} /></span>
        <h2 id="terms-gate-title">{returning ? "We've updated our terms" : "Before you get started"}</h2>
        <p>
          {returning
            ? "Our Terms of Service and Privacy Policy changed. Please take a look and agree to keep using StressCare."
            : "StressCare keeps your tasks, schedule and check-in results, so we want you to know how they're used and who can see them. Your check-ins are never shown to other people."}
        </p>
        <ul className="terms-gate-links">
          <li><Link to="/terms-of-service" state={{ from }}>Terms of Service</Link></li>
          <li><Link to="/privacy-policy" state={{ from }}>Privacy Policy</Link></li>
        </ul>
        <label className="terms-gate-check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} autoFocus />
          <span>I've read and agree to the Terms of Service and Privacy Policy.</span>
        </label>
        <div className="terms-gate-actions">
          <button type="button" className="primary-button" onClick={accept} disabled={!agreed || busy}>
            {busy ? "Saving..." : "Agree and continue"}
          </button>
          <button type="button" className="ghost-button" onClick={() => logout()} disabled={busy}>
            Log out instead
          </button>
        </div>
      </div>
    </div>
  );
}
