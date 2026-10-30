// A titled row of primitives in the development specimen.
export default function Section({ title, children }) {
  return (
    <section className="specimen-section">
      <h2>{title}</h2>
      <div className="specimen-row">{children}</div>
    </section>
  );
}
