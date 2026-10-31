import { useLocation } from "react-router-dom";
import { Button, Card, Chip } from "@/shared/ui";
import { daysAgoText } from "@/shared/lib/dates";
import { QUESTIONNAIRES } from "@/features/checkin/questionnaires";
import { resultWords } from "@/features/checkin/resultWords";
import { surveyDue } from "@/features/checkin/surveyDue";
import HistoryLine from "./HistoryLine";
import "./checkin-cards.css";

// One check-in on Wellbeing (Figma 51:295, 51:323): the result in words, when it was taken, a small
// history line and a Check in button. Same card for PSS-10 and WHO-5. `history` is this check-in's last
// results, newest first.
export default function CheckInCard({ kind, user, history, now }) {
  const { icon: Icon, name, cardSubtitle, max, duration, scoreField, lastField } = QUESTIONNAIRES[kind];
  const { pathname, search, hash } = useLocation();
  const score = user?.[scoreField] ?? null;
  const last = user?.[lastField] || null;
  const taken = score !== null && last !== null;
  const { due } = surveyDue(kind, user, null, now);

  return (
    <Card as="article" className="wellbeing-checkin" aria-labelledby={`wellbeing-checkin-${kind}`}>
      <header className="wellbeing-checkin__head">
        <span className="wellbeing-chip" aria-hidden="true"><Icon size={20} /></span>
        <div className="wellbeing-checkin__titles">
          <h3 id={`wellbeing-checkin-${kind}`} className="wellbeing-section-title">{name}</h3>
          <p className="wellbeing-checkin__subtitle">{cardSubtitle}</p>
        </div>
        <Chip tone={due ? "watch" : "neutral"} className="wellbeing-checkin__due">{due ? "Due now" : "Not due yet"}</Chip>
      </header>
      <div className="wellbeing-checkin__result">
        <div className="wellbeing-checkin__words">
          <p className="wellbeing-checkin__headline">{taken ? resultWords(kind, score) : "Not taken yet"}</p>
          <p className="wellbeing-checkin__subtitle">
            {taken ? `Checked ${daysAgoText(last, now).toLowerCase()}` : `Takes about ${duration}.`}
          </p>
        </div>
        {taken && <HistoryLine rows={history} max={max} />}
      </div>
      <Button variant="secondary" to={`/wellbeing/check-in/${kind}`} state={{ from: pathname + search + hash }}>
        Check in
      </Button>
    </Card>
  );
}
