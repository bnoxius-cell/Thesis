// Steps for the bottom-right Guide (components/PageTour.jsx). Each `target` matches a
// `data-tour="..."` attribute on the page. Steps whose target isn't on screen are skipped, so one
// list can cover a page's different states (new account or not, list or a single schedule).
// Keep the text short and in the app's voice: plain, warm, no jargon.

export const DASHBOARD_TOUR = [
  {
    target: "dash-greeting",
    title: "Your day at a glance",
    text: "Today pulls your classes, tasks and check-ins together, so you can see what today and this week look like.",
  },
  {
    target: "dash-setup",
    title: "Getting set up",
    text: "Four small steps: your classes, a few numbers about your week, a first check-in and a task. Each one ticks off by itself. You can hide the card any time.",
  },
  {
    target: "dash-checkin",
    title: "Check-ins",
    text: "Two short, well-known surveys on stress and well-being. They take a couple of minutes and make the reading on this page more personal. Not today is fine too.",
  },
  {
    target: "dash-quick",
    title: "Add a task in seconds",
    text: "Type what needs doing, pick when it's due and roughly how long it'll take, then Add. Class, notes and the rest are optional under More details. Tap any task below to change it.",
  },
  {
    target: "dash-today",
    title: "Today",
    text: "Your classes happening now and later, plus anything due today or overdue, in one short list. Online classes get a Join button.",
  },
  {
    target: "dash-coming",
    title: "Coming up",
    text: "Tasks due in the next 7 days, soonest first, so nothing sneaks up on you.",
  },
  {
    target: "dash-doing",
    title: "This week",
    text: "How full your week is, in words, with the few things adding the most. It's an estimate of workload, not of your stress. See details has the full picture.",
  },
  {
    target: "dash-next",
    title: "Next step",
    text: "One thing worth doing now: an earlier night before an early class, a deadline you could move, or a tip for your week. Move it changes the due date, and you can undo it.",
  },
  {
    target: "dash-week",
    title: "The next 7 days",
    text: "Each day's study time next to your classes and activities, so heavy days stand out early, plus how many of this week's tasks are done. Tap it for the details.",
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
    text: "Its name, whose it is, and who else can see it. The arrows next to the name switch to another schedule or open the list of all of them.",
  },
  {
    target: "sched-actions",
    title: "Add, share and more",
    text: "Add puts in a task, class, exam, activity or event. Share works like Google Docs: invite people as viewers or editors, or turn on a link. More has the theme, make a copy, rename and delete. You'll only see the buttons your access allows.",
  },
  {
    target: "sched-week",
    title: "Your week",
    text: "Classes, exams and your own tasks, day by day. On a phone, tap a day in the strip to see it; a dot means something's planned. Tap anything to see or change it, and use the arrows to move between weeks. Each day has Add and a day-off button.",
  },
  {
    target: "sched-tasks",
    title: "Your tasks",
    text: "Add a task at the top: a title, when it's due and roughly how long it takes. Tap the circle to mark one done, or the title to edit it. The menu has Copy share code and Delete. Got a 6-digit code from a classmate? Add it here.",
  },
  {
    target: "sched-plan",
    title: "Your study plan",
    text: "How the next 7 days of tasks fit around your classes. Days that are too full are the ones to look at first.",
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

export const WELLBEING_TOUR = [
  {
    target: "well-drivers",
    title: "What's shaping your week",
    text: "The few things that push your week up or down, each with a word and a short reason.",
  },
  {
    target: "well-week",
    title: "Your week",
    text: "The next seven days side by side: classes, task work and how much room is left each day.",
  },
  {
    target: "well-focus",
    title: "What to focus on",
    text: "Short, practical tips based on your own week. Up to five.",
  },
  {
    target: "well-ideas",
    title: "Ideas to lighten the week",
    text: "Deadlines you could move to a lighter day. Nothing changes until you tap Move it, and you can undo it.",
  },
  {
    target: "well-checkins",
    title: "Check-ins",
    text: "Take or retake the stress and well-being check-ins, see what the last result meant and when the next one is due.",
  },
  {
    target: "well-sleep",
    title: "Sleep",
    text: "Your sleep target, and a suggested bedtime when you have an early class or exam tomorrow.",
  },
  {
    target: "well-how",
    title: "How this works",
    text: "In plain words, what goes into your score and where the two check-ins come from.",
  },
];
