// A public holiday or a day the student marked off.
export default function HolidayNote({ name }) {
  return (
    <li className="plan-dayoff">
      <p className="plan-dayoff__label">Day off</p>
      <p className="plan-dayoff__name">{name}</p>
    </li>
  );
}
