import { useCallback, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/shared/ui";
import NotFound from "@/app/NotFound";
import usePageTitle from "@/app/usePageTitle";
import CheckInIntro from "./CheckInIntro";
import CheckInQuestion from "./CheckInQuestion";
import CheckInResult from "./CheckInResult";
import { isCheckInKind, QUESTIONNAIRES } from "./questionnaires";
import useCheckIn from "./useCheckIn";
import "./checkin.css";

function CheckInFlow({ questionnaire }) {
  const navigate = useNavigate();
  const from = useLocation().state?.from;
  const flow = useCheckIn(questionnaire.kind);
  const { step, answers, saving, error, score } = flow;
  const saved = score !== null;
  usePageTitle(`${questionnaire.name} check-in`);

  // Back to the page the student came from, or Wellbeing when they opened the link directly.
  const exit = useCallback(() => {
    navigate(typeof from === "string" && from.startsWith("/") ? from : "/wellbeing", { replace: true });
  }, [navigate, from]);

  // Esc leaves, as Exit does, except while the answers are going up.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !saving) exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, exit]);

  return (
    <div className="checkin">
      <header className="checkin-top">
        <Button variant="ghost" disabled={saving} onClick={exit}>Exit</Button>
        <span className="checkin-top__label">{questionnaire.name} check-in</span>
      </header>
      <div className="checkin-main">
        {saved && <CheckInResult questionnaire={questionnaire} score={score} />}
        {!saved && step === -1 && <CheckInIntro questionnaire={questionnaire} onStart={flow.start} onExit={exit} />}
        {!saved && step >= 0 && (
          <CheckInQuestion
            questionnaire={questionnaire}
            step={step}
            count={flow.count}
            picked={answers[step]}
            saving={saving}
            error={error}
            onPick={flow.choose}
            onNext={flow.next}
            onBack={flow.back}
          />
        )}
      </div>
    </div>
  );
}

// The check-in screen: /wellbeing/check-in/pss or /who. Anything else is a page that doesn't exist.
export default function CheckInPage() {
  const { kind } = useParams();
  if (!isCheckInKind(kind)) return <NotFound />;
  return <CheckInFlow key={kind} questionnaire={QUESTIONNAIRES[kind]} />;
}
