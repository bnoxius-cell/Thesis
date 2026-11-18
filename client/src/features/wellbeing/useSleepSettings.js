import { useCallback, useEffect, useRef, useState } from "react";
import useSaveRhythm from "./useSaveRhythm";
import { bedtimeLabel, sleepForm, sleepPayload } from "./rhythm";

const SAVE_DELAY_MS = 350;

// The Tonight card's three controls (wake time, sleep target, travel), saved as they change. The pickers
// read `form` at once; the card's numbers follow the server (useSaveRhythm refreshes the account). Changes
// within SAVE_DELAY_MS go out as one save, and a change made while a save is running waits for it and then
// sends the latest values, so the last pick always wins. A pick still waiting when the card closes is saved.
// `status` is "idle", "saving", "saved" or "error" (with the server's message in `error`). `movedTo` is the new
// bedtime ("10:15 pm") after a save that changed it, empty otherwise.
export default function useSleepSettings(user) {
  const { save, saving, error } = useSaveRhythm();
  const [form, setForm] = useState(() => sleepForm(user));
  const [saved, setSaved] = useState(false);
  const [movedTo, setMovedTo] = useState("");
  const announced = useRef(bedtimeLabel(form));
  const latest = useRef(form);
  const timer = useRef(null);
  const running = useRef(false);
  const again = useRef(false);

  const flush = useCallback(async () => {
    timer.current = null;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    let ok;
    do {
      again.current = false;
      ok = await save(sleepPayload(latest.current));
    } while (again.current);
    running.current = false;
    const bedtime = bedtimeLabel(latest.current);
    if (ok && bedtime !== announced.current) setMovedTo(announced.current ? bedtime : "");
    if (ok) announced.current = bedtime;
    setSaved(ok);
  }, [save]);

  const change = (key) => (value) => {
    latest.current = { ...latest.current, [key]: value };
    setForm(latest.current);
    setSaved(false);
    setMovedTo("");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  useEffect(() => () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    flush();
  }, [flush]);

  const status = saving ? "saving" : error ? "error" : saved ? "saved" : "idle";
  return { form, change, status, error, movedTo };
}
