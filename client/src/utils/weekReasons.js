import { BAND_LABEL } from "./workload";

// The one-sentence reading under the band, in the app's own voice.
export const BAND_MESSAGE = {
  "Light Workload": "This week looks manageable. You're in a good spot.",
  "Moderate Workload": "You've got a fair amount going on, but it's steady.",
  "Heavy Workload": "Your plate is fuller than usual, so it's worth pacing yourself.",
  "Critical Overload": "This is a lot right now. Be gentle with yourself, and start with the smallest thing.",
};

export const bandLabel = (band) => BAND_LABEL[band] || band;

const REASON = {
  time: { low: "Deadlines are light", moderate: "Deadlines are steady", high: "Deadlines are heavy" },
  schedule: { low: "Your timetable leaves plenty of room", moderate: "Classes take a fair share of your week", high: "Classes and activities fill most of your week" },
  stress: { low: "Your stress check-in looks calm", moderate: "Your stress check-in shows some strain", high: "Your stress check-in is on the high side" },
  wellbeing: { low: "Your well-being check-in looks good", moderate: "Your well-being check-in is middling", high: "Your well-being check-in is low" },
};

// The top two things shaping the week, in words. `dueThisWeek` is how many open tasks and exams
// fall within the next 7 days, so the deadline line can say how many.
export function topReasons(parts = [], dueThisWeek = 0, count = 2) {
  return [...parts]
    .sort((a, b) => b.value - a.value)
    .slice(0, count)
    .map((part) => {
      const text = REASON[part.key]?.[part.level] || part.label;
      return part.key === "time" && dueThisWeek > 0
        ? `${text}: ${dueThisWeek} ${dueThisWeek === 1 ? "thing" : "things"} due this week`
        : text;
    });
}
