import { useCallback, useState } from "react";
import { submitSurvey } from "@/shared/api/surveys";
import { useAuth } from "@/pages/authentication/AuthContext";
import { QUESTIONNAIRES } from "./questionnaires";

// The state of one check-in. Nothing is saved until the last answer is in and the student asks for the
// result, so leaving earlier throws the answers away.
//   step      -1 is the intro, 0 and up are the questions
//   answers   one picked value per question, null while unanswered
//   score     the server's score once it is saved (the result screen); null before
//   saving    true while the answers are going up; error says why the last try failed
export default function useCheckIn(kind) {
  const { getUserData } = useAuth();
  const { questions } = QUESTIONNAIRES[kind];
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState(() => Array(questions.length).fill(null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState(null);

  const choose = useCallback((value) => {
    setAnswers((list) => list.map((picked, i) => (i === step ? value : picked)));
    setError("");
  }, [step]);

  const submit = useCallback(async () => {
    if (saving || score !== null || answers.includes(null)) return;
    setSaving(true);
    setError("");
    const { data, error: failure } = await submitSurvey(kind, answers);
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    setScore(data.score);
    getUserData(); // so the cards, Home and the week read the new score
  }, [saving, score, answers, kind, getUserData]);

  const next = useCallback(() => {
    if (step === questions.length - 1) submit();
    else setStep((s) => s + 1);
  }, [step, questions.length, submit]);

  const back = useCallback(() => setStep((s) => Math.max(-1, s - 1)), []);
  const start = useCallback(() => setStep(0), []);

  return { step, answers, saving, error, score, choose, next, back, start, count: questions.length };
}
