import { Gauge } from "lucide-react";
import CheckInStepper from "./CheckInStepper";
import { CHECKIN_COPY } from "../utils/checkinCopy";

const { measures, whyItHelps, meta } = CHECKIN_COPY.pss;

// Perceived Stress Scale (PSS-10). Items 4, 5, 7 and 8 are reverse scored, which the server does
// (server/utils/surveyScoring.js), so the answers are sent as picked.
const CONFIG = {
  kind: "pss",
  title: "Stress check-in",
  icon: Gauge,
  citation: "Perceived Stress Scale (PSS-10), Cohen, Kamarck & Mermelstein, 1983",
  introFirst: "Your first check-in",
  introAgain: "Time for your monthly check-in",
  measures,
  whyItHelps,
  meta,
  stem: "In the last month, how often have you...",
  questions: [
    "been upset because of something that happened unexpectedly?",
    "felt that you were unable to control the important things in your life?",
    "felt nervous and \"stressed\"?",
    "felt confident about your ability to handle your personal problems?",
    "felt that things were going your way?",
    "found that you could not cope with all the things that you had to do?",
    "been able to control irritations in your life?",
    "felt that you were on top of things?",
    "been angered because of things that were outside of your control?",
    "felt difficulties were piling up so high that you could not overcome them?",
  ],
  options: [
    { value: 0, label: "Never" },
    { value: 1, label: "Almost never" },
    { value: 2, label: "Sometimes" },
    { value: 3, label: "Fairly often" },
    { value: 4, label: "Very often" },
  ],
};

export default function PSSSurveyModal({ isFirstTime = false, onClose, onComplete, onRemindLater }) {
  return <CheckInStepper config={CONFIG} isFirstTime={isFirstTime} onClose={onClose} onComplete={onComplete} onRemindLater={onRemindLater} />;
}
