import { createContext } from "react";

// openFeedback() shows the feedback dialog from anywhere in the signed-in area (the avatar menu,
// Settings > Help). Outside the provider it does nothing.
export const FeedbackContext = createContext({ openFeedback: () => {} });
