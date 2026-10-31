import { ClipboardCheck, HeartPulse } from "lucide-react";
import { PSS_VALID_DAYS, WHO_VALID_DAYS } from "@/utils/workload";

// Everything that differs between the two check-ins: the wording, the answers, the citation and the
// date window. The server scores them (utils/surveyScoring.js, including the reverse-scored PSS items),
// so each answer carries only the value that gets sent.
//   cardSubtitle  the line under the name on the Wellbeing card
//   scoreField, lastField  where the account keeps the latest score and when it was taken
//   stem          the start of every question, so each item reads as one sentence
export const QUESTIONNAIRES = {
  pss: {
    kind: "pss",
    name: "PSS-10",
    icon: ClipboardCheck,
    cardSubtitle: "Stress, past month",
    period: "this month",
    max: 40,
    duration: "2 minutes",
    scoreField: "latestPSSScore",
    lastField: "lastPSSSubmission",
    validDays: PSS_VALID_DAYS,
    intro: {
      title: "How stressed have you felt this past month?",
      lead: "Ten short questions, about 2 minutes. Your answers help StressCare fit your plan to how you've really been.",
      measures: "How overwhelming life has felt over the last month.",
      citation: "Based on the Perceived Stress Scale (Cohen, Kamarck & Mermelstein, 1983).",
    },
    stem: "In the last month, how often have you",
    questions: [
      "been upset because of something that happened unexpectedly?",
      "felt that you were unable to control the important things in your life?",
      "felt nervous and “stressed”?",
      "felt confident about your ability to handle your personal problems?",
      "felt that things were going your way?",
      "found that you could not cope with all the things that you had to do?",
      "been able to control irritations in your life?",
      "felt that you were on top of things?",
      "been angered because of things that were outside of your control?",
      "felt difficulties were piling up so high that you could not overcome them?",
    ],
    answers: [
      { value: 0, label: "Never" },
      { value: 1, label: "Almost never" },
      { value: 2, label: "Sometimes" },
      { value: 3, label: "Fairly often" },
      { value: 4, label: "Very often" },
    ],
  },
  who: {
    kind: "who",
    name: "WHO-5",
    icon: HeartPulse,
    cardSubtitle: "Wellbeing, past 2 weeks",
    period: "these two weeks",
    max: 100,
    duration: "a minute",
    scoreField: "latestWHOScore",
    lastField: "lastWHOSubmission",
    validDays: WHO_VALID_DAYS,
    intro: {
      title: "How have you been feeling these past two weeks?",
      lead: "Five short questions, about a minute. Your answers help StressCare fit your plan to how you've really been.",
      measures: "How you've felt over the last two weeks: mood, calm, energy, rest and interest.",
      citation: "Based on the WHO-5 Well-Being Index (World Health Organization, 1998).",
    },
    stem: "Over the last two weeks,",
    questions: [
      "I have felt cheerful and in good spirits.",
      "I have felt calm and relaxed.",
      "I have felt active and vigorous.",
      "I woke up feeling fresh and rested.",
      "My daily life has been filled with things that interest me.",
    ],
    answers: [
      { value: 5, label: "All of the time" },
      { value: 4, label: "Most of the time" },
      { value: 3, label: "More than half the time" },
      { value: 2, label: "Less than half the time" },
      { value: 1, label: "Some of the time" },
      { value: 0, label: "At no time" },
    ],
  },
};

export const isCheckInKind = (kind) => Object.hasOwn(QUESTIONNAIRES, kind);
