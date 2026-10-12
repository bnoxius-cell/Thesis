import { useRef } from 'react';

// An accessible tab list. `tabs` is [{ id, label, count? }]; the caller renders the panel with
// role="tabpanel" and aria-labelledby={`tab-${id}`}. Arrow keys, Home and End move between tabs.
export default function Tabs({ tabs, value, onChange, label = 'Sections' }) {
  const refs = useRef({});

  const move = (index) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    onChange(tab.id);
    refs.current[tab.id]?.focus();
  };

  const onKeyDown = (event, index) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); move(index + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); move(index - 1); }
    else if (event.key === 'Home') { event.preventDefault(); move(0); }
    else if (event.key === 'End') { event.preventDefault(); move(tabs.length - 1); }
  };

  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            ref={(node) => { refs.current[tab.id] = node; }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={`tab ${selected ? 'is-selected' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
            {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
