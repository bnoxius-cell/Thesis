import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { answerQuestion, finishSession } from "@/shared/api/reviewers";
import { answerBody, emptyDraft, isDraftReady } from "./answerDraft";

// One run through a session's questions, one at a time. Picking or typing only fills the draft;
// "check" sends it and the server answers with the right answer and why, so nothing here knows the key.
//   question   the question on screen        index, total   where the student is
//   draft      what the student has given (see answerDraft.js)   canCheck   the draft is enough to send
//   result     the server's grade for this question, or null
//   busy       an answer or the finish is on its way
//   summary    { session, review, progress } once the run is over
export default function usePracticeRun(reviewerId, session) {
  const { questions } = session;
  const [results, setResults] = useState(() => new Map(session.answers.map((a) => [String(a.questionId), a])));
  const [index, setIndex] = useState(() => {
    const next = questions.findIndex((q) => !session.answers.some((a) => String(a.questionId) === String(q._id)));
    return next === -1 ? questions.length - 1 : next;
  });
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);

  const question = questions[index];
  const [draft, setDraft] = useState(() => (question ? emptyDraft(question) : null));
  const result = question ? results.get(String(question._id)) ?? null : null;
  const isLast = index === questions.length - 1;
  const canCheck = Boolean(question) && isDraftReady(question, draft);

  const check = useCallback(async () => {
    if (!question || result || busy || !canCheck) return;
    setBusy(true);
    const { data, error } = await answerQuestion(reviewerId, session._id, question._id, answerBody(question, draft));
    setBusy(false);
    if (error) toast.error(error);
    else setResults((map) => new Map(map).set(String(question._id), data.result));
  }, [reviewerId, session._id, question, result, busy, canCheck, draft]);

  const next = useCallback(async () => {
    if (!result || busy) return;
    if (!isLast) {
      setDraft(emptyDraft(questions[index + 1]));
      setIndex((i) => i + 1);
      return;
    }
    setBusy(true);
    const { data, error } = await finishSession(reviewerId, session._id);
    setBusy(false);
    if (error) toast.error(error);
    else setSummary(data);
  }, [reviewerId, session._id, questions, index, result, busy, isLast]);

  return { question, index, total: questions.length, draft, setDraft, canCheck, result, busy, isLast, check, next, summary };
}
