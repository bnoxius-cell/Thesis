import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { IconButton } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import SearchPanel from "./SearchPanel";
import { searchEntries } from "./searchIndex";
import useSearchIndex from "./useSearchIndex";
import "./search.css";

const DEBOUNCE_MS = 150;

// The header search (Figma 16:3): a pill with "Search" in it, left of the bell. It looks through the
// student's subjects, reviewers and tasks, loaded the first time it is used. Arrows move, Enter opens,
// Escape closes. Under 1024px (no frame) it is an icon that opens a full-width bar with the list under it.
export default function HeaderSearch() {
  const compact = useMediaQuery("(max-width: 1023px)");
  const navigate = useNavigate();
  const index = useSearchIndex();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef(null);
  const trigger = useRef(null);
  const listId = useId();
  const optionId = (i) => `${listId}-${i}`;

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const results = useMemo(() => searchEntries(index.entries, query), [index.entries, query]);
  const showingList = open && index.status === "ready" && results.length > 0;

  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const reset = () => {
    close();
    setText("");
    setQuery("");
  };
  const edit = (event) => {
    setText(event.target.value);
    setActive(-1);
  };
  const openSearch = () => {
    setOpen(true);
    index.load();
  };
  const closePhone = () => {
    reset();
    trigger.current?.focus();
  };
  const pick = (entry) => {
    reset();
    input.current?.blur();
    navigate(entry.to);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (compact) closePhone();
      else if (open) close();
      else setText("");
      return;
    }
    if (!showingList && event.key !== "ArrowDown") return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return openSearch();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((prev) => (prev + step + results.length) % results.length);
    } else if (event.key === "Enter" && results.length > 0) {
      event.preventDefault();
      pick(results[Math.max(active, 0)]);
    }
  };

  const field = (
    <input
      ref={input}
      type="search"
      className="shell-search__input"
      placeholder="Search"
      aria-label="Search"
      role="combobox"
      aria-expanded={open}
      aria-controls={showingList ? listId : undefined}
      aria-activedescendant={showingList && active >= 0 ? optionId(active) : undefined}
      aria-autocomplete="list"
      autoComplete="off"
      enterKeyHint="search"
      value={text}
      onChange={edit}
      onFocus={openSearch}
      onKeyDown={onKeyDown}
    />
  );
  const panel = open && (
    <div className="shell-search__panel" onMouseDown={(event) => event.preventDefault()}>
      <SearchPanel
        id={listId}
        status={index.status}
        query={query}
        results={results}
        active={active}
        optionId={optionId}
        onPick={pick}
        onRetry={index.load}
      />
    </div>
  );
  const count = (
    <p className="sr-only" role="status">
      {showingList ? `${results.length} results` : ""}
    </p>
  );

  if (!compact) {
    return (
      <div
        className="shell-search"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) close();
        }}
      >
        {field}
        {panel}
        {count}
      </div>
    );
  }

  return (
    <>
      <IconButton ref={trigger} icon={Search} label="Search" onClick={openSearch} />
      {open &&
        createPortal(
          <PhoneSearch input={input} onClose={closePhone} field={field} panel={panel} count={count} />,
          document.body,
        )}
    </>
  );
}

// The phone's full-width bar. It sits in the body, not the header, because the stuck header's
// blur would otherwise become the box a fixed element is placed in.
function PhoneSearch({ input, onClose, field, panel, count }) {
  useEffect(() => {
    input.current?.focus();
  }, [input]);
  return (
    <div className="shell-search-sheet" role="dialog" aria-label="Search">
      <div className="shell-search-sheet__scrim" onClick={onClose} aria-hidden="true" />
      <div className="shell-search-sheet__bar">
        <div className="shell-search-sheet__row">
          {field}
          <IconButton icon={X} label="Close search" onClick={onClose} />
        </div>
        {panel}
        {count}
      </div>
    </div>
  );
}
