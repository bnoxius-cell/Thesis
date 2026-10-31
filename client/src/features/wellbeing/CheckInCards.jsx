import { SURVEY_KINDS } from "@/features/checkin/surveyDue";
import CheckInCard from "./CheckInCard";
import useCheckInHistory from "./useCheckInHistory";

// The two check-in cards side by side (stacked on phones). `user` is the signed-in account.
export default function CheckInCards({ user, now }) {
  const history = useCheckInHistory();
  return (
    <div className="wellbeing-checkins">
      {SURVEY_KINDS.map((kind) => (
        <CheckInCard key={kind} kind={kind} user={user} history={history[kind]} now={now} />
      ))}
    </div>
  );
}
