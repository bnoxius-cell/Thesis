// Steps for the bottom-right Guide (components/PageTour.jsx). Each `target` matches a
// `data-tour="..."` attribute on the page. Steps whose target isn't on screen are skipped, so one
// list can cover a page's different states (new account or not, list or a single schedule).
// Keep the text short and in the app's voice: plain, warm, no jargon.

export const DASHBOARD_TOUR = [
  {
    target: "dash-greeting",
    title: "Your day at a glance",
    text: "The dashboard pulls your tasks, your class schedule and your check-ins together, so you can see what today and this week look like.",
  },
  {
    target: "dash-welcome",
    title: "Start with one thing",
    text: "Add a task or put in your class schedule. The rest of this page fills in once there's something to plan around.",
  },
  {
    target: "dash-checkin",
    title: "Check-ins",
    text: "Two short, well-known surveys on stress and well-being. They take a couple of minutes and make the reading on this page more personal. Not today is fine too.",
  },
  {
    target: "dash-today",
    title: "Today",
    text: "What's happening now, what's later and what's due soon. Online classes get a Join button. Later in the day it looks ahead to tomorrow.",
  },
  {
    target: "dash-doing",
    title: "How you're doing",
    text: "A read on your week from 0 to 100, based on your deadlines, your classes and your recent check-ins. The bars show what's adding the most.",
  },
  {
    target: "dash-week",
    title: "How your week adds up",
    text: "Each day's study time next to your classes and activities, so heavy days stand out early. Tasks that don't fit in a day are marked.",
  },
  {
    target: "dash-guidance",
    title: "Where to focus",
    text: "A few tips picked for your week, like a busy day coming up, a free gap between classes or your next deadline.",
  },
  {
    target: "dash-suggestions",
    title: "Suggestions",
    text: "When the week doesn't fit, this offers to move a task to a later day. Move it changes the due date, and you can undo it. Not now hides it until tomorrow.",
  },
  {
    target: "dash-tasks",
    title: "All your tasks",
    text: "Every open task, with buttons to edit it, mark it as done or delete it. Got a 6-digit tag from a classmate? Type it here to add their task. New tasks are added from your Schedule.",
  },
];

export const SCHEDULE_TOUR = [
  // The list of schedules
  {
    target: "sched-intro",
    title: "Your schedules",
    text: "Your main schedule holds your classes and exams, and the dashboard plans around it. Extra schedules are for anything else, like a gym routine or a part-time job.",
  },
  {
    target: "sched-list-actions",
    title: "Start here",
    text: "Create your schedule, add a task, or open a classmate's schedule with the code or link they sent you.",
  },
  {
    target: "sched-main",
    title: "Your main schedule",
    text: "Open it to see your week. Everything in it counts toward the workload on your dashboard.",
  },
  {
    target: "sched-extras",
    title: "Extra schedules",
    text: "Each one has its own setting for whether it counts toward your workload.",
  },
  {
    target: "sched-shared",
    title: "Shared with you",
    text: "Schedules friends shared with you. Open one to follow it as it changes, or use Add to mine to copy the parts you want.",
  },
  // One open schedule
  {
    target: "sched-head",
    title: "This schedule",
    text: "Its name, whose it is, and who else can see it. The line under the name says if it's private or shared.",
  },
  {
    target: "sched-actions",
    title: "Add, share and more",
    text: "Add puts in a task, class, exam, activity or event. Share works like Google Docs: invite people as viewers or editors, or turn on a link. More has make a copy, rename and delete. You'll only see the buttons your access allows.",
  },
  {
    target: "sched-week",
    title: "Your week",
    text: "Classes, exams and your own tasks, day by day. Tap anything to see or change it, and use the arrows to move between weeks. Each day has buttons to add something or mark it as a day off.",
  },
  {
    target: "sched-activity",
    title: "Recent changes",
    text: "When other people can edit this schedule, the latest changes are listed here with who made them.",
  },
  {
    target: "sched-cal",
    title: "Days off",
    text: "Philippine holidays are already filled in. Tap days to pick them, then make them days off or clear a holiday you still have classes on. Classes set to skip holidays drop off on those days.",
  },
];

export const REVIEWERS_TOUR = [
  // The list of reviewers
  {
    target: "rev-intro",
    title: "Reviewers",
    text: "Turn your notes, a handout or a module into a short reviewer with key terms and practice questions.",
  },
  {
    target: "rev-upload",
    title: "Upload a PDF",
    text: "Use a PDF with selectable text, up to 10 MB. Scans and photos of pages won't work. It takes about a minute, and you can leave the page while it's made.",
  },
  {
    target: "rev-list",
    title: "Your reviewers",
    text: "Each card shows your last score. Open one to read it or practice.",
  },
  // One open reviewer
  {
    target: "rev-head",
    title: "This reviewer",
    text: "The More menu has rename, a fresh set of questions from the same PDF, and delete.",
  },
  {
    target: "rev-practice",
    title: "Learning Mode",
    text: "One question at a time. Pick an answer, then submit to see if it's right and why. If you leave halfway, you can resume within a day.",
  },
  {
    target: "rev-targeted",
    title: "More on weak spots",
    text: "Ask for new questions on the topics you're struggling with. They're added as their own set to practice.",
  },
  {
    target: "rev-progress",
    title: "Topics",
    text: "After a session, each topic is marked weak, fair or strong. Practice weak topics gives you only those questions.",
  },
  {
    target: "rev-notes",
    title: "The reviewer itself",
    text: "A summary, key points and terms from your PDF. It's made by AI, so check anything that looks off against your notes.",
  },
  // Learning Mode and results
  {
    target: "rev-learning",
    title: "Answering",
    text: "Tap an answer (or press 1 to 4), then Submit answer. You'll see the right one and why. End session keeps the ones you've answered.",
  },
  {
    target: "rev-results",
    title: "Your results",
    text: "Your score and how each topic went. From here you can practice the weak topics or ask for new questions on them.",
  },
];
