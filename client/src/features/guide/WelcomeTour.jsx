import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/pages/authentication/AuthContext";
import { openDialogCount, subscribeOpenDialogs } from "@/shared/ui/ModalShell";
import TourDialog from "./TourDialog";
import useGuide from "./useGuide";
import { markWelcomeShown, welcomeShownThisVisit } from "./welcomeVisit";

const SETTLE_MS = 1200;

// The welcome tour, once per account. It opens on its own like "What's new" does: after the legal
// gate, with no other dialog open and the page settled. A /home?tour=1 link (Settings > Help, the
// account menu) opens it again at once and takes the param off the address; that replay never saves
// anything. Any way of closing an automatic run marks the tour done. Mounted once in AppLayout, so
// check-ins and Practice runs never get it.
export default function WelcomeTour() {
  const { isLoggedin, userData } = useAuth();
  const { guide, ready, markWelcomeDone } = useGuide();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const dialogs = useSyncExternalStore(subscribeOpenDialogs, openDialogCount);
  const [tour, setTour] = useState(null); // null, or { replay } while the window is open

  const signedIn = Boolean(isLoggedin && userData && userData.termsVersion === userData.currentLegalVersion);
  const wantsReplay = new URLSearchParams(search).get("tour") === "1";
  const due = signedIn && ready && !guide.welcomeDone && !welcomeShownThisVisit();

  if (signedIn && wantsReplay && !tour) setTour({ replay: true });

  useEffect(() => {
    if (!tour?.replay || !wantsReplay) return;
    markWelcomeShown();
    const params = new URLSearchParams(search);
    params.delete("tour");
    const rest = params.toString();
    navigate({ pathname, search: rest ? `?${rest}` : "", hash }, { replace: true });
  }, [tour, wantsReplay, pathname, search, hash, navigate]);

  useEffect(() => {
    if (!due || tour || dialogs > 0) return undefined;
    const timer = setTimeout(() => {
      if (openDialogCount() > 0) return;
      markWelcomeShown();
      setTour({ replay: false });
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [due, tour, dialogs, pathname]);

  if (!tour) return null;

  const close = () => {
    if (!tour.replay) markWelcomeDone();
    setTour(null);
  };
  return <TourDialog onClose={close} />;
}
