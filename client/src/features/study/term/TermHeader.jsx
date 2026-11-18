const STEPS = 3;

// The top of each step (TR-2): "Step 2 of 3", the three-segment progress, the title and the line under it. The
// segments fill as the student moves on. Focus lands here when the step changes, so a screen reader hears it.
export default function TermHeader({ step, title, subtitle, titleId, headerRef }) {
  return (
    <header ref={headerRef} tabIndex={-1} className="term-header">
      <p className="term-header__step">Step {step + 1} of {STEPS}</p>
      <div className="term-progress" aria-hidden="true">
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className="term-progress__segment" data-done={i <= step || undefined} />
        ))}
      </div>
      <h2 id={titleId} className="term-header__title">{title}</h2>
      <p className="term-header__subtitle">{subtitle}</p>
    </header>
  );
}
