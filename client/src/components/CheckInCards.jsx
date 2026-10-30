import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../pages/authentication/AuthContext";
import PSSSurveyModal from "./PSSSurveyModal";
import WHOSurveyModal from "./WHOSurveyModal";
import { meaningOf } from "../utils/checkinResult";
import { CHECKIN_COPY } from "../utils/checkinCopy";
import { PSS_VALID_DAYS, WHO_VALID_DAYS } from "../utils/workload";

const SCALES = {
  pss: {
    title: "Stress (PSS-10)",
    max: 40,
    validDays: PSS_VALID_DAYS,
    Modal: PSSSurveyModal,
  },
  who: {
    title: "Well-being (WHO-5)",
    max: 100,
    validDays: WHO_VALID_DAYS,
    Modal: WHOSurveyModal,
  },
};

const longDate = (value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const shortDay = (value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function dueText(last, validDays, now) {
  if (!last) return "";
  const due = new Date(last);
  due.setHours(0, 0, 0, 0);
  due.setDate(due.getDate() + validDays);
  return due.getTime() <= now.getTime() ? "Due again now." : `Due again ${shortDay(due)}.`;
}

// One card per check-in on Wellbeing: when it was last taken, what the result means in plain
// words, the score small and muted, when it is due again, and the last five results.
export default function CheckInCards({ work }) {
  const { backendUrl } = useAuth();
  const [history, setHistory] = useState({ pss: [], who: [] });
  const [open, setOpen] = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/surveys/history`, { withCredentials: true });
      if (data.success) setHistory({ pss: data.pss, who: data.who });
    } catch (err) {
      console.error("Failed to load check-in history", err);
    }
  }, [backendUrl]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const { userData, now } = work;
  const info = {
    pss: { score: userData?.latestPSSScore ?? null, last: userData?.lastPSSSubmission || null, status: work.pss.status },
    who: { score: userData?.latestWHOScore ?? null, last: userData?.lastWHOSubmission || null, status: work.who.status },
  };

  const done = () => {
    setOpen(null);
    work.refreshUser();
    loadHistory();
  };
  const ActiveModal = open ? SCALES[open].Modal : null;

  return (
    <>
      <div className="checkin-cards">
        {Object.entries(SCALES).map(([kind, scale]) => {
          const { score, last, status } = info[kind];
          const rows = history[kind];
          return (
            <article className="checkin-card" key={kind}>
              <header>
                <h3>{scale.title}</h3>
                <p className="checkin-card-lead">{CHECKIN_COPY[kind].short}</p>
              </header>
              {score === null || !last ? (
                <p>You haven't taken this one yet. It takes about {kind === "pss" ? "two minutes" : "a minute"}.</p>
              ) : (
                <>
                  <p className="checkin-card-meaning">{meaningOf(kind, score)}</p>
                  <p className="checkin-card-meta">
                    {kind === "pss" ? "PSS-10" : "WHO-5"}: {score} of {scale.max} · taken {longDate(last)}
                  </p>
                  <p className="checkin-card-meta">
                    {status === "stale" ? "This one is out of date, so it isn't counted in your week. " : ""}
                    {dueText(last, scale.validDays, now)}
                  </p>
                </>
              )}
              <button type="button" className="secondary-button small" onClick={() => setOpen(kind)}>
                {last ? "Retake" : "Take it"}
              </button>
              {rows.length > 1 && (
                <ul className="checkin-history" aria-label={`Recent ${scale.title} results`}>
                  {rows.map((row) => (
                    <li key={row.createdAt}>
                      <span>{longDate(row.createdAt)}</span>
                      <span>{row.score} of {scale.max}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>

      {/* Mounted only while open, so each one starts from a clean slate. */}
      {ActiveModal && (
        <ActiveModal
          isFirstTime={!info[open].last}
          onClose={() => setOpen(null)}
          onComplete={done}
        />
      )}
    </>
  );
}
