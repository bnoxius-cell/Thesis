import "./card.css";

// A surface with a border and soft shadow. `as` picks the element (a Link or button for a
// clickable card). `interactive` adds the hover lift, for clickable cards only.
export default function Card({ as: Tag = "div", interactive = false, className = "", children, ...rest }) {
  const classes = `ui-card ${interactive ? "ui-card--interactive" : ""} ${className}`.trim();
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
