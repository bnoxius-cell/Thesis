import { Link } from "react-router-dom";
import Badge from "./Badge";
import { selectOnArrowKey } from "./rovingKeys";
import "./tabs.css";

// A tab list in a pill track (Figma Tab 61:73). `items` is [{ value, label, count?, to?, id?,
// panelId? }]. With `to` a tab is a router link (URL-driven tabs: derive `value` from the URL);
// without it, a button that calls onChange(value). Arrow keys, Home and End move and select.
// `panelId` adds aria-controls: pass it only when that panel is in the page. `block` stretches the
// track to its row and shares the width.
export default function Tabs({ items, value, onChange, label, block = false, className = "" }) {
  const selectedIndex = items.findIndex((item) => item.value === value);
  const tabbable = Math.max(selectedIndex, 0);

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`ui-tabs ${block ? "ui-tabs--block" : ""} ${className}`.trim()}
      onKeyDown={(e) => selectOnArrowKey(e, '[role="tab"]')}
    >
      {items.map((item, i) => {
        const Tab = item.to ? Link : "button";
        return (
          <Tab
            key={item.value}
            {...(item.to ? { to: item.to } : { type: "button" })}
            role="tab"
            id={item.id}
            aria-selected={i === selectedIndex}
            aria-controls={item.panelId}
            tabIndex={i === tabbable ? 0 : -1}
            className="ui-tab"
            onClick={() => onChange?.(item.value)}
          >
            {item.label}
            <Badge count={item.count} />
            {item.count > 0 && <span className="sr-only">, {item.count}</span>}
          </Tab>
        );
      })}
    </div>
  );
}
