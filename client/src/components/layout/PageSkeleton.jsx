// What a page shows while it loads: a title bar and two blocks, inside the real shell, so the
// sidebar and footer don't jump when the page arrives. Heights match a typical page head and card.
export default function PageSkeleton({ label = 'Loading' }) {
  return (
    <div className="page-skeleton" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <span className="skeleton page-skeleton-title" aria-hidden="true" />
      <span className="skeleton page-skeleton-block" aria-hidden="true" />
      <span className="skeleton page-skeleton-block is-short" aria-hidden="true" />
    </div>
  );
}
