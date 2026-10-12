import CheckInStepper from "./CheckInStepper";

// WHO-5 Well-Being Index. The server multiplies the raw total by 4 (0 to 100).
const CONFIG = {
  kind: "who",
  title: "Well-being check-in",
  citation: "WHO-5 Well-Being Index, World Health Organization, 1998",
  introFirst: "Your first check-in",
  introAgain: "Time for your two-week check-in",
  introBody: "Five quick questions, about a minute. Your answers help us tailor your workload to more than just your task list.",
  window: "These ask about the last two weeks.",
  stem: "Over the last two weeks...",
  questions: [
    "I have felt cheerful and in good spirits.",
    "I have felt calm and relaxed.",
    "I have felt active and vigorous.",
    "I woke up feeling fresh and rested.",
    "My daily life has been filled with things that interest me.",
  ],
  options: [
    { value: 5, label: "All of the time" },
    { value: 4, label: "Most of the time" },
    { value: 3, label: "More than half the time" },
    { value: 2, label: "Less than half the time" },
    { value: 1, label: "Some of the time" },
    { value: 0, label: "At no time" },
  ],
};

export default function WHOSurveyModal({ isFirstTime = false, onClose, onComplete, onRemindLater }) {
  return <CheckInStepper config={CONFIG} isFirstTime={isFirstTime} onClose={onClose} onComplete={onComplete} onRemindLater={onRemindLater} />;
}
