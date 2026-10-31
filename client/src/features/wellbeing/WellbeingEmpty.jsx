// The hero's body for a new account (Figma 53:459): one line and seven empty bar stubs where the week
// will draw. Adding a class or task isn't offered here until those dialogs are drawn.
export default function WellbeingEmpty() {
  return (
    <div className="wellbeing-empty">
      <p className="wellbeing-hero__title">Add classes or tasks to see your week</p>
      <div className="wellbeing-empty__stubs" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => <span key={i} />)}
      </div>
    </div>
  );
}
