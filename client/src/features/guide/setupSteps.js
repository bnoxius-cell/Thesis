// The four Get started steps, in order. `key` is the name /api/user/setup uses; `action` is what the
// row's button does: open the global Add on a kind, or go to a route. Plain data, no imports.
export const SETUP_STEPS = [
  { key: "classes", label: "Add your classes", hint: "They repeat every week, so it takes one go.", cta: "Add class", action: { add: "class" } },
  { key: "task", label: "Add a task", hint: "Something with a due date, like a lab report.", cta: "Add task", action: { add: "task" } },
  { key: "checkin", label: "Do a check-in", hint: "Two minutes, and your plan fits you better.", cta: "Check in", action: { to: "/wellbeing/check-in/pss" } },
  { key: "reviewer", label: "Make a reviewer", hint: "Practice questions from your own notes.", cta: "Make one", action: { add: "reviewer" } },
];

// How many steps are done, from the `steps` object the server sends.
export const doneCount = (steps) => SETUP_STEPS.filter(({ key }) => steps?.[key]).length;
