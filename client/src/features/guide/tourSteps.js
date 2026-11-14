import { BookOpen, CalendarDays, HeartPulse, House, Users } from "lucide-react";

// The welcome tour, in order (Figma desktop 315:48, 315:220, 315:402, phone 316:312, 316:390; the
// wording is approved on the copy board 316:478). `icons` fill the step's circle; step 1 has none and
// shows the logo. `area` names the menu entry the step is about, or null when it isn't about one.
export const TOUR_STEPS = [
  {
    key: "welcome",
    icons: null,
    title: "Welcome to StressCare",
    text: "Your classes, tasks and check-ins in one calm place. Here's a quick look around. It takes less than a minute.",
    area: null,
  },
  {
    key: "home",
    icons: [House],
    title: "Home",
    text: "Your day at a glance: classes now and next, what's due, and one next step worth doing.",
    area: "Home",
  },
  {
    key: "plan",
    icons: [CalendarDays],
    title: "Plan",
    text: "Your timetable and tasks. Add your classes once and they repeat every week. The + Add button works from any page.",
    area: "Plan",
  },
  {
    key: "study",
    icons: [BookOpen],
    title: "Study",
    text: "Your subjects, files and practice. Turn your notes into a reviewer or flashcards and practise before exams.",
    area: "Study",
  },
  {
    key: "people",
    icons: [HeartPulse, Users],
    title: "Wellbeing and People",
    text: "Wellbeing shows how full your week is and has two short check-ins. They help StressCare fit your plan to you, and they aren't a test. People is for groups and friends, so you can share timetables with your class.",
    area: "Wellbeing, People",
  },
];

// The "Where to find it" chip: the menu is on the left from 1024px and a bottom bar under it.
export const whereToFind = (step, phone) => (step.area ? `${phone ? "Bottom bar" : "Left menu"}: ${step.area}` : null);
