// How each saved pace reads on the Your rhythm card.
const PACE_LABEL = { "catch-up": "Relaxed pace", steady: "Balanced pace", "high-performance": "Intense pace" };

const hoursText = (n) => `${Math.round(n * 10) / 10}h`;

// The chips on the Your rhythm card, from the account: study hours, sleep, pace and (when set) travel.
// `profile` is the one from profileFromUser, so a new account still gets the defaults.
export function rhythmChips(profile) {
  const chips = [
    `${hoursText(profile.studyHoursPerDay)} study a day`,
    `${hoursText(profile.sleepHours)} sleep`,
    PACE_LABEL[profile.wellbeingGoal] ?? PACE_LABEL.steady,
  ];
  if (profile.travelMinutesPerDay > 0) chips.push(`${profile.travelMinutesPerDay} min travel`);
  return chips;
}
