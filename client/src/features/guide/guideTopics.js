// The six how-tos in Settings > Help > Guides and the header search (plan 37, section 3.4). Pure, with
// relative imports only, so a server test can load it (server/tests/searchIndex.guide.test.js). Every
// number and button name comes from the code that owns it; step text never types them by hand.
import { ADD_OPTIONS } from "../../app/shell/add/addOptions.js";
import { BAND_LABEL, PSS_VALID_DAYS, WHO_VALID_DAYS } from "../../utils/workload.js";
import { WORKLOAD_NOTE } from "../../utils/weekReading.js";
import { LEAD_TIMES } from "../settings/leadTimes.js";
import { MAX_SOURCES, SOURCE_TYPES_TEXT } from "../study/reviewerForm.js";

// A row of the "+ Add" menu, by its kind.
const addRow = (kind) => ADD_OPTIONS.find((option) => option.kind === kind).title;
const orList = (items) => `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;

export const GUIDE_TOPICS = [
  {
    key: "classes",
    title: "Add your classes and timetable",
    steps: [
      `Open Plan, then tap + Add and choose ${addRow("class")}.`,
      "Pick the subject, the days and the times. It repeats every week.",
      "A timetable shared in a group chat has an Add to my plan button.",
    ],
    goTo: { to: "/plan", label: "Go to Plan" },
  },
  {
    key: "tasks",
    title: "Add a task and get reminders",
    steps: [
      `Tap + Add and choose ${addRow("task")}.`,
      "Give it a name, a due date and a size. It goes on your plan and counts toward your week.",
      `In Settings, turn on Task reminders and pick How early: ${orList(LEAD_TIMES.map((time) => time.label))} before it's due.`,
    ],
    goTo: { to: "/plan?view=tasks", label: "Go to Tasks" },
  },
  {
    key: "week",
    title: "Read your week",
    steps: [
      `The This week card on Home gives your week a label: ${orList(Object.values(BAND_LABEL))}.`,
      "Tap Details to see what is behind it on Wellbeing.",
      `${WORKLOAD_NOTE} A check-in older than ${PSS_VALID_DAYS} days (stress) or ${WHO_VALID_DAYS} days (well-being) is left out until you take it again.`,
      "About StressCare explains how the numbers work.",
    ],
    goTo: { to: "/wellbeing#load", label: "Go to Wellbeing" },
  },
  {
    key: "checkin",
    title: "Do a check-in",
    steps: [
      "Open Wellbeing and find the PSS-10 and WHO-5 cards.",
      "Tap Check in on a card and answer the questions. PSS-10 looks at stress over the past month, WHO-5 at well-being over the past 2 weeks.",
      `A stress check-in counts for ${PSS_VALID_DAYS} days and a well-being check-in for ${WHO_VALID_DAYS} days. After that the card says Due now.`,
      "Your scores help StressCare adjust your plan. They aren't a diagnosis.",
    ],
    goTo: { to: "/wellbeing#feeling", label: "Go to Check-ins" },
  },
  {
    key: "reviewer",
    title: "Make a reviewer and practise",
    steps: [
      `Tap + Add and choose ${addRow("reviewer")}.`,
      `Add your notes (${SOURCE_TYPES_TEXT}, up to ${MAX_SOURCES} files) and tap Create reviewer.`,
      "It takes a moment. Your reviewer shows as processing until the questions are ready.",
      "Open it and tap Start Learning Mode to practise, or Make flashcards to turn it into a deck.",
    ],
    goTo: { to: "/study/practice", label: "Go to Reviewers" },
  },
  {
    key: "people",
    title: "Groups and friends",
    steps: [
      `Open People, then tap + Add and choose ${addRow("group")}. Share its join code with your classmates.`,
      `Got a code? Choose ${addRow("join")} and enter it.`,
      `To add a friend, choose ${addRow("friend")}, enter their friend code and tap Send request. Your own code is on the Friends page.`,
    ],
    goTo: { to: "/people", label: "Go to People" },
  },
];

// The anchor a topic opens at: /settings/help#guide-<key>.
export const guideId = (key) => `guide-${key}`;
