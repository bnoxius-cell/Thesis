// One row of a check-in card: a small icon chip, a bold title and a line under it
// (Figma 54:554, 54:637). `icon` is a lucide component.
export default function CheckInFact({ icon: Icon, title, children }) {
  return (
    <div className="checkin-fact">
      <span className="checkin-fact__icon" aria-hidden="true"><Icon size={20} /></span>
      <div className="checkin-fact__text">
        <p className="checkin-fact__title">{title}</p>
        <p className="checkin-fact__body">{children}</p>
      </div>
    </div>
  );
}
