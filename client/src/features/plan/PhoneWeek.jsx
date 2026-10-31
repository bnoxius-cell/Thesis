import DayAgenda from "./DayAgenda";
import DayStrip from "./DayStrip";

// The week on a phone or tablet: the day strip, then the chosen day's agenda. `direction` is which
// way the week was stepped, so the new week slides in from that side.
export default function PhoneWeek({ days, selected, onSelect, now, onToggle, direction }) {
  return (
    <div className="plan-phone plan-slide" data-direction={direction}>
      <DayStrip days={days} selectedKey={selected.key} onSelect={onSelect} />
      <DayAgenda day={selected} now={now} onToggle={onToggle} />
    </div>
  );
}
