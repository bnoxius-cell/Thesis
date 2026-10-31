// The small dot that says how heavy a day looks: green for light, amber for heavy, never red. It is
// decoration; the day's own label says the same in words.
export default function LoadDot({ load }) {
  return <span className={`plan-dot plan-dot--${load}`} aria-hidden="true" />;
}
