import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { answerQuestion, finishSession } from "@/shared/api/reviewers";

// One run through a session's questions, one at a time. Picking only selects; "check" sends the
// pick and the server answers with the right answer and why, so nothing here knows the key.
//   question   the question on screen        index, total   where the student is
//   picked     the option chosen, or null    result         the server's grade for this question, or null
//   busy       an answer or the finish is on its way
//   summary    { session, review, progress } once the run is over
export default function usePracticeRun(reviewerId, session) {
  const { questions } = session;
  const [results, setResults] = useState(() => new Map(session.answers.map((a) => [String(a.questionId), a])));
  const [index, setIndex] = useState(() => {
    const next = questions.findIndex((q) => !session.answers.some((a) => String(a.questionId) === String(q._id)));
    return next === -1 ? questions.length - 1 : next;
  });
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);

  const question = questions[index];
  const result = question ? results.get(String(question._id)) ?? null : null;
  const isLast = index === questions.length - 1;

  const check = useCallback(async () => {
    if (!question || result || busy || picked === null) return;
    setBusy(true);
    const { data, error } = await answerQuestion(reviewerId, session._id, question._id, picked);
    setBusy(false);
    if (error) toast.error(error);
    else setResults((map) => new Map(map).set(String(question._id), data.result));
  }, [reviewerId, session._id, question, result, busy, picked]);

  const next = useCallback(async () => {
    if (!result || busy) return;
    setPicked(null);
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    setBusy(true);
    const { data, error } = await finishSession(reviewerId, session._id);
    setBusy(false);
    if (error) toast.error(error);
    else setSummary(data);
  }, [reviewerId, session._id, result, busy, isLast]);

  return { question, index, total: questions.length, picked, setPicked, result, busy, isLast, check, next, summary };
}
