const dotState = (position, current) => {
  if (position < current) return "done";
  return position === current ? "current" : "todo";
};

// Progress dots for a short tour (Figma StepDots 315:32): finished dots and the current one are the
// accent colour, the current one is a wider pill, the rest are grey. Decorative: the dialog says
// "Step N of M" to screen readers.
export default function StepDots({ count, current }) {
  return (
    <div className="step-dots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="step-dots__dot" data-state={dotState(i + 1, current)} />
      ))}
    </div>
  );
}
