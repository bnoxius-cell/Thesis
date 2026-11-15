// The six points of "How the sleep plan works" (Figma 332:852). Point 4 uses the student's own numbers from
// sleepSummary(); with no window yet it asks for a wake time instead.
export function sleepExplainerPoints({ window, target }) {
  const yours = window
    ? `Tonight: bed by ${window.bed}, up at ${window.wake}, ${target} h.`
    : "Pick a wake time above to see yours.";
  return [
    { label: "What it is", text: "We work out a bedtime from your first class or exam tomorrow, so you still get your sleep target." },
    { label: "How to set it up", text: "Set your wake time, sleep target and travel time on the Tonight card, then add your classes in Plan." },
    { label: "Where to look", text: "The Tonight card above. It updates when your plan changes." },
    { label: "What to look for", text: `A bedtime, a wake time and the hours between them. ${yours}` },
    { label: "What it means", text: "A bedtime earlier than usual means tomorrow starts early. If it says your usual bedtime works, nothing starts early." },
    { label: "What to change", text: "Change your wake time, sleep target or travel time on the Tonight card above. A longer target moves your bedtime earlier by the same amount." },
  ];
}
