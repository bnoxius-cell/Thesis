import "./empty-state.css";

// What a list, card or page shows when there is nothing in it yet: a soft icon, a title, one line
// and the next action. `icon` is a lucide component. `page` is for a whole empty page: more room,
// and it carries the page's one ambient layer. `titleAs` sets the heading level to fit the page.
export default function EmptyState({
  icon: Icon,
  title,
  children,
  actions,
  page = false,
  titleAs: Title = "h2",
  className = "",
}) {
  const classes = `ui-empty ${page ? "ui-empty--page ambient" : ""} ${className}`.trim();
  return (
    <div className={classes}>
      {Icon && (
        <span className="ui-empty__icon">
          <Icon size={28} aria-hidden="true" />
        </span>
      )}
      <Title className="ui-empty__title">{title}</Title>
      {children && <p className="ui-empty__text">{children}</p>}
      {actions && <div className="ui-empty__actions">{actions}</div>}
    </div>
  );
}
