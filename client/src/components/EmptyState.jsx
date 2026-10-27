// An icon, one sentence and (optionally) one action, for a list or page with nothing in it yet.
export default function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={24} aria-hidden="true" className="empty-state-icon" />}
      {title && <strong>{title}</strong>}
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
