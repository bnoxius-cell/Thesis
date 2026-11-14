import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSetup } from "@/shared/api/user";
import useGuide from "./useGuide";

// The data behind the Get started card on Home. While the card is hidden or finished (or the account has
// no guide yet) it never fetches. Otherwise it loads the steps on mount, and `reload()` loads them again
// after an Add. A failure leaves things as they were, so a first failure just means no card: guidance is
// a courtesy, never an error.
//   visible   show the card
//   steps     { classes, task, checkin, reviewer } (booleans)
//   finished  all four were done at some point during this visit, so the card says "You're all set"
//             until it is dismissed or Home is left, even if a step is undone meanwhile
//   dismiss   marks the card finished for good (the server already recorded it)
export default function useSetupSteps() {
  const { guide, ready, markSetupDone } = useGuide();
  const active = ready && !guide.setupDone && !guide.setupHidden;
  const [steps, setSteps] = useState(null);
  const [finished, setFinished] = useState(false);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!active) return;
    const request = ++latest.current;
    const { data } = await fetchSetup();
    if (!data || request !== latest.current) return; // failed, or a newer request is on its way
    setSteps(data.steps);
    if (data.done) setFinished(true);
  }, [active]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Leaving Home with the card in its "all set" state counts as dismissing it.
  const finishedRef = useRef(false);
  useEffect(() => {
    finishedRef.current = finished;
  }, [finished]);
  useEffect(() => () => {
    if (finishedRef.current) markSetupDone();
  }, [markSetupDone]);

  return { visible: active && steps !== null, steps, finished, reload, dismiss: markSetupDone };
}
