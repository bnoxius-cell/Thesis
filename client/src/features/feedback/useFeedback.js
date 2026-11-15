import { useContext } from "react";
import { FeedbackContext } from "./feedbackContext";

export default function useFeedback() {
  return useContext(FeedbackContext);
}
