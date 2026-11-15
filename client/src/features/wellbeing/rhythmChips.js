// How each saved pace reads on the Your rhythm card.
const PACE_LABEL = { "catch-up": "Relaxed pace", steady: "Balanced pace", "high-performance": "Intense pace" };

const hoursText = (n) => `${Math.round(n * 10) / 10}h`;

// The chips on the Your rhythm card, from the account: study hours and pace (sleep and travel are on the
// Tonight card). `profile` is the one from profileFromUser, so a new account still gets the defaults.
export const rhythmChips = (profile) => [
  `${hoursText(profile.studyHoursPerDay)} study a day`,
  PACE_LABEL[profile.wellbeingGoal] ?? PACE_LABEL.steady,
];
