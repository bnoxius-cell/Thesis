// "How you've been" (Figma 51:2): the home of the two check-in cards, which W2 passes in as children.
// The Check-ins link in the sidebar and the header's Check in button scroll here.
export default function FeelingSection({ children }) {
  return (
    <section id="feeling" className="wellbeing-feeling" aria-labelledby="wellbeing-feeling">
      <header className="wellbeing-feeling__head">
        <h2 id="wellbeing-feeling" className="wellbeing-section-heading">How you've been</h2>
        <p>Your own answers, kept apart from the load estimate.</p>
      </header>
      {children}
    </section>
  );
}
