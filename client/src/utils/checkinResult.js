// What the student sees after a check-in. Pure, so every wording and branch can be tested.
// The score is for the system to know the student, not a diagnosis, so there are no labels like
// "anxious" here: one plain sentence, what changed in the plan, one small thing, some credit.

export const PSS_BANDS = { calmMax: 13, highMin: 27 };
export const WHO_BANDS = { lowMax: 28, okayMin: 51, strainedBelow: 50 };

// How far a score has to move before it counts as better or worse than last time.
const SAME_WITHIN = { pss: 2, who: 8 };

export function meaningOf(kind, score) {
  if (kind === "pss") {
    if (score <= PSS_BANDS.calmMax) return "Your stress has been on the lower side this past month.";
    if (score < PSS_BANDS.highMin) return "You've had a fair amount of stress this past month.";
    return "This past month has been a lot.";
  }
  if (score >= WHO_BANDS.okayMin) return "You've been feeling mostly okay lately.";
  if (score > WHO_BANDS.lowMax) return "Your energy and mood have been lower than they could be.";
  return "The last two weeks have been hard.";
}

// "better" / "same" / "worse" against the last result, or null when there is none.
export function directionOf(kind, score, previousScore) {
  if (previousScore === null || previousScore === undefined) return null;
  const change = score - previousScore;
  if (Math.abs(change) <= SAME_WITHIN[kind]) return "same";
  const improved = kind === "pss" ? change < 0 : change > 0;
  return improved ? "better" : "worse";
}

const DIRECTION_TEXT = {
  better: "That's better than last time.",
  same: "That's about the same as last time.",
  worse: "That's harder than last time.",
};

const scoreLine = (kind, score) => (kind === "pss" ? `PSS-10: ${score} of 40` : `WHO-5: ${score} of 100`);

// kind          "pss" | "who"
// score         the score the server worked out
// previousScore the last result of the same check-in, or null
// pssScore, whoScore  the fresh scores after this check-in (null when none is fresh)
// strained      isStrained() with the new score included
// suggestion    the top move idea (only used when strained), or null
// sleep         the sleepPlan() result for tomorrow, or null
// smallestTask  title of the open task with the fewest hours, or ""
// finishedCount tasks finished in the last 7 days
export function buildCheckInResult({
  kind, score, previousScore = null, pssScore = null, whoScore = null, strained = false,
  suggestion = null, sleep = null, smallestTask = "", finishedCount = 0,
}) {
  const direction = directionOf(kind, score, previousScore);
  const highStress = pssScore !== null && pssScore >= PSS_BANDS.highMin;
  const lowWellbeing = whoScore !== null && whoScore < WHO_BANDS.strainedBelow;

  let today;
  if (sleep) {
    today = { kind: "sleep", text: sleep.text };
  } else if (highStress) {
    today = {
      kind: "small-task",
      text: smallestTask
        ? `Pick your smallest task, "${smallestTask}", and give it 25 minutes. Then stop.`
        : "Pick the smallest thing on your list and give it 25 minutes. Then stop.",
    };
  } else if (lowWellbeing) {
    today = { kind: "enjoy", text: "Put one thing you enjoy in your week, even 30 minutes." };
  } else {
    today = { kind: "steady", text: "Keep your sleep and meals steady this week." };
  }

  const encouragement = [
    finishedCount > 0
      ? `You've finished ${finishedCount} ${finishedCount === 1 ? "task" : "tasks"} this week. That counts.`
      : "Checking in is a good step. Let's make this week lighter.",
  ];
  if (highStress || lowWellbeing) encouragement.push("You don't have to fix the whole week today.");

  const movable = strained && suggestion ? suggestion : null;
  return {
    meaning: meaningOf(kind, score),
    direction,
    directionText: direction ? DIRECTION_TEXT[direction] : "",
    scoreLine: scoreLine(kind, score),
    plan: {
      suggestion: movable,
      warnSooner: strained,
      fits: !movable,
    },
    today,
    encouragement,
  };
}
