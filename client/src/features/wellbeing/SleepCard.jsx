import { CircleCheck, Moon, Sun } from "lucide-react";
import { Card, Field, SelectButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import useSleepSettings from "./useSleepSettings";
import { bedtimeLabel, bedtimeSum, rhythmOptions } from "./rhythm";

const statusText = (status, movedTo) =>
  status === "saved" ? (movedTo ? `Saved. Bedtime moved to ${movedTo}.` : "Saved") : status === "saving" ? "Saving" : "";

// Sleep (Figma 332:706): tonight's bedtime, the window from bed to wake and the hours aimed for, with
// the wake time, sleep target and travel that the bedtime is worked out from, saved as they change.
// `summary` comes from sleepSummary.js and `user` is the account the controls start from.
export default function SleepCard({ summary, user }) {
  const { headline, window, target, note } = summary;
  const { form, change, status, error, movedTo } = useSleepSettings(user);
  const options = rhythmOptions(form);
  // Native pickers on phones: the long lists (times, travel) are far easier in the system sheet.
  const phone = useMediaQuery("(max-width: 480px)");

  const picker = (label, key, list, placeholder) => (
    <Field label={label}>
      {(control) => (
        <SelectButton
          block
          native={phone}
          options={list}
          value={form[key]}
          onChange={change(key)}
          label={label}
          placeholder={placeholder}
          {...control}
        />
      )}
    </Field>
  );

  return (
    <Card as="section" id="sleep" className="wellbeing-sleep" aria-labelledby="wellbeing-tonight">
      <div className="wellbeing-sleep__top">
        <span className="wellbeing-chip" aria-hidden="true"><Moon size={18} /></span>
        <div className="wellbeing-sleep__tonight">
          <h2 id="wellbeing-tonight" className="wellbeing-eyebrow">Tonight</h2>
          <p className="wellbeing-sleep__headline">{headline}</p>
          {note && <p className="wellbeing-sleep__note">{note}</p>}
        </div>
        {window && (
          <div className="wellbeing-sleep__window">
            <span className="wellbeing-time"><Moon size={20} aria-hidden="true" />{window.bed}</span>
            <span className="wellbeing-sleep__target">
              <span className="wellbeing-sleep__bar" aria-hidden="true" />
              <span>{target} h target</span>
            </span>
            <span className="wellbeing-time"><Sun size={20} aria-hidden="true" />{window.wake}</span>
          </div>
        )}
      </div>
      <hr className="wellbeing-sleep__divider" />
      <div className="wellbeing-sleep__controls">
        {picker("Wake time", "usualWakeTime", options.wakeTimes, "Pick a time")}
        {picker("Sleep target", "sleepHours", options.sleep)}
        <Field label="Bedtime (worked out)" hint={bedtimeSum(form) || "Pick a wake time to see it."}>
          {(control) => (
            <output {...control} className="wellbeing-sleep__bedtime">
              <Moon size={18} aria-hidden="true" />
              {bedtimeLabel(form) || "Not set yet"}
            </output>
          )}
        </Field>
        {picker("Total travel per day", "travelMinutesPerDay", options.travel)}
      </div>
      <div className="wellbeing-sleep__footer">
        <p
          className={`wellbeing-sleep__status${status === "error" ? " wellbeing-sleep__status--error" : ""}${status === "saved" ? " wellbeing-sleep__status--saved" : ""}`}
          role={status === "error" ? "alert" : "status"}
        >
          {status === "saved" && <CircleCheck size={16} aria-hidden="true" />}
          {status === "error" ? error : statusText(status, movedTo)}
        </p>
        <p className="wellbeing-sleep__help">
          Changes save as you make them. Your bedtime is your wake time minus your sleep target. For travel, add
          your trip to campus and your trip home.
        </p>
      </div>
    </Card>
  );
}
