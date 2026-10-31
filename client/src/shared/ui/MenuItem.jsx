import { useContext } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { MenuContext } from "./menuContext";

// A row in a Menu: a button (`onSelect`) or a router link (`to`). `selected` marks the current
// choice with a check: in a listbox every row is an option, in a menu a row with `selected`
// becomes a radio item. tone="danger" is for deleting things. `icon` is a leading lucide icon.
export default function MenuItem({ icon: Icon, selected, tone, to, onSelect, disabled = false, className = "", children, ...rest }) {
  const { role, close } = useContext(MenuContext);
  const isChoice = selected !== undefined;
  const itemRole = role === "menuitem" && isChoice ? "menuitemradio" : role;
  const state = role === "option" ? { "aria-selected": Boolean(selected) } : isChoice ? { "aria-checked": selected } : {};
  const classes = `ui-menu__item ${tone === "danger" ? "ui-menu__item--danger" : ""} ${className}`.trim();

  const select = () => {
    onSelect?.();
    close(!to); // a link moves the student on, so focus doesn't go back to the trigger
  };
  const content = (
    <>
      {Icon && <Icon size={18} aria-hidden="true" />}
      <span className="ui-menu__label">{children}</span>
      {selected && <Check size={16} className="ui-menu__check" aria-hidden="true" />}
    </>
  );

  if (to) {
    return (
      <Link to={to} role={itemRole} tabIndex={-1} className={classes} onClick={select} {...state} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" role={itemRole} tabIndex={-1} className={classes} disabled={disabled} onClick={select} {...state} {...rest}>
      {content}
    </button>
  );
}
