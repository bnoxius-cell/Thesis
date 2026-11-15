// What a student says is behind a check-in. Sensitive like the scores: never sent to Gemini, friends or groups.
export const CHECKIN_CONTEXTS = ['deadlines', 'groupmates', 'money-family', 'health-sleep'];

export const isCheckinContext = (value) => CHECKIN_CONTEXTS.includes(value);
