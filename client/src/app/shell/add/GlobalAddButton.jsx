import { useState } from "react";
import { useLocation } from "react-router-dom";
import { BookOpen, CalendarPlus, ClipboardCheck, FileText, Flag, Layers, Link2, ListChecks, Plus, Shapes, UserPlus, UsersRound } from "lucide-react";
import { Button, Menu, MenuItem, Modal } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import { useGlobalAdd } from "./addContext";
import { addSections } from "./addOptions";
import "./global-add.css";

const ICONS = {
  tasks: ListChecks,
  "calendar-plus": CalendarPlus,
  "clipboard-check": ClipboardCheck,
  flag: Flag,
  shapes: Shapes,
  subjects: BookOpen,
  reviewers: FileText,
  flashcards: Layers,
  file: FileText,
  people: UsersRound,
  link: Link2,
  friends: UserPlus,
};

// One row: a 36px accent-soft tile, the title and a one-line hint (Figma AddMenuRow 219:3284).
function RowContent({ option }) {
  const Icon = ICONS[option.icon];
  return (
    <>
      <span className="global-add__tile"><Icon size={20} aria-hidden="true" /></span>
      <span className="global-add__text">
        <span className="global-add__title">{option.title}</span>
        <span className="global-add__hint">{option.hint}</span>
      </span>
    </>
  );
}

// The "+ Add" in every page header (Figma 221:4053): a pill with a menu under it from 720px, the same pill
// opening a bottom sheet below. Both list the page's own group first, then the rest, and a pick
// opens the one dialog host. The dialog opens a tick after the menu or sheet has closed, so the focus
// return and the scroll lock have settled and two dialogs never stack.
export default function GlobalAddButton() {
  const { open } = useGlobalAdd();
  const { pathname } = useLocation();
  const phone = useMediaQuery("(max-width: 719.98px)");
  const [sheet, setSheet] = useState(false);
  const sections = addSections(pathname);

  const pick = (kind) => setTimeout(() => open(kind), 0);

  if (phone) {
    return (
      <>
        <button type="button" className="global-add__btn" aria-haspopup="dialog" onClick={() => setSheet(true)}>
          <Plus size={16} strokeWidth={2.25} aria-hidden="true" />
          <span>Add</span>
        </button>
        {sheet && (
          <Modal
            sheet
            title="Add"
            className="global-add__sheet"
            onClose={() => setSheet(false)}
            actions={(close) => <Button variant="ghost" onClick={close}>Cancel</Button>}
          >
            {sections.map(({ heading, rows }) => (
              <section key={heading} className="global-add__group" aria-label={heading}>
                <h3 className="global-add__eyebrow">{heading}</h3>
                {rows.map((option) => (
                  <button
                    key={option.kind}
                    type="button"
                    className="global-add__row"
                    onClick={() => {
                      setSheet(false);
                      pick(option.kind);
                    }}
                  >
                    <RowContent option={option} />
                  </button>
                ))}
              </section>
            ))}
          </Modal>
        )}
      </>
    );
  }

  return (
    <Menu
      align="end"
      label="Add"
      menuClassName="global-add__menu"
      trigger={(props) => (
        <button type="button" className="global-add__btn" {...props}>
          <Plus size={16} strokeWidth={2.25} aria-hidden="true" />
          <span>Add</span>
        </button>
      )}
    >
      {sections.map(({ heading, rows }) => (
        <div key={heading} role="group" aria-label={heading} className="global-add__group">
          <p className="global-add__eyebrow" aria-hidden="true">{heading}</p>
          {rows.map((option) => (
            <MenuItem key={option.kind} className="global-add__item" onSelect={() => pick(option.kind)}>
              <RowContent option={option} />
            </MenuItem>
          ))}
        </div>
      ))}
    </Menu>
  );
}
