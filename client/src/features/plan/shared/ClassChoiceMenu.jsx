import { useState } from "react";
import { Check, ChevronDown, Copy, EyeOff, Pencil, Trash2, UserPen } from "lucide-react";
import { Button, Menu, MenuItem, Modal } from "@/shared/ui";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import "./class-choice.css";

// The rows of the menu, as data: which section they sit in, and when each is chosen or offered. `me` is the
// student's own layer; `everyone` (admins) changes the shared class itself.
const rowsFor = ({ choice, who, actions }) => [
  {
    key: "follow",
    section: "me",
    icon: Check,
    title: "I take this",
    hint: `Follows ${who}. Changes reach you.`,
    selected: choice === "follow",
  },
  { key: "hidden", section: "me", icon: EyeOff, title: "Not taking this", hint: "Hides it from your week.", selected: choice === "hidden" },
  {
    key: "customize",
    section: "me",
    icon: UserPen,
    title: "Customize mine",
    hint: "Makes a class in your own timetable. Adds the subject if you don't have it yet.",
    selected: choice === "custom",
  },
  { key: "all", section: "me", icon: Copy, title: "Make it all mine", hint: "Copies every class here to your own timetable." },
  { key: "edit", section: "everyone", icon: Pencil, title: "Edit for everyone", hint: `Changes it for the whole ${who.replace("the ", "")}.` },
  { key: "delete", section: "everyone", icon: Trash2, title: "Delete for everyone", tone: "danger" },
].filter((row) => row.section === "me" || actions[row.key]);

const SECTIONS = [
  { key: "me", label: "For me" },
  { key: "everyone", label: "For everyone" },
];

function RowText({ title, hint }) {
  return (
    <span className="class-menu__text">
      <span className="class-menu__title">{title}</span>
      {hint && <span className="class-menu__hint">{hint}</span>}
    </span>
  );
}

// "Class options" on a class of a timetable shared with the student (Figma GW-6: member menu 383:2934, admin
// 383:3226, phone sheet 383:3532): their own choices under "For me", and for admins Edit and Delete under "For
// everyone". An anchored menu from 720px and a bottom sheet on a phone, with the same rows.
//   layer       layerRef(entry): `choice` is the student's current one
//   subtitle    the line under the sheet's title on a phone ("Class · BSIT 3-1 timetable")
//   actions     what each row does, by key: follow, hidden, customize, all (always drawn), and edit and delete, which
//               only people who may change the shared class are given (they make up "For everyone")
export default function ClassChoiceMenu({ layer, subtitle, actions, busy = false }) {
  const phone = useMediaQuery("(max-width: 719.98px)");
  const [sheet, setSheet] = useState(false);
  const who = layer.group ? "the group" : "the timetable";
  const rows = rowsFor({ choice: layer.choice, who, actions });

  const label = "Class options";
  const sections = SECTIONS.map((section) => ({ ...section, rows: rows.filter((row) => row.section === section.key) })).filter(
    (section) => section.rows.length > 0,
  );

  if (phone) {
    const choose = (row) => {
      setSheet(false);
      actions[row.key]?.();
    };
    return (
      <>
        <Button variant="secondary" icon={ChevronDown} className="item-footer__options" disabled={busy} onClick={() => setSheet(true)}>
          {label}
        </Button>
        {sheet && (
          <Modal sheet title={layer.title} subtitle={subtitle} onClose={() => setSheet(false)} className="class-menu-sheet">
            {sections.map((section) => (
              <div key={section.key} className="class-menu__section">
                <p className="class-menu__eyebrow">{section.label}</p>
                {section.rows.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    className={`class-menu__row ${row.selected ? "is-selected" : ""} ${row.tone === "danger" ? "is-danger" : ""}`.trim()}
                    aria-pressed={row.selected === undefined ? undefined : row.selected}
                    onClick={() => choose(row)}
                  >
                    <row.icon size={20} aria-hidden="true" />
                    <RowText title={row.title} hint={row.hint} />
                    {row.selected && <Check size={20} aria-hidden="true" className="class-menu__check" />}
                  </button>
                ))}
              </div>
            ))}
          </Modal>
        )}
      </>
    );
  }

  return (
    <Menu
      label={`${label} for ${layer.title}`}
      className="item-footer__options"
      menuClassName="class-menu"
      trigger={(props) => (
        <Button variant="secondary" icon={ChevronDown} disabled={busy} {...props}>
          {label}
        </Button>
      )}
    >
      {sections.map((section) => (
        <div key={section.key} role="group" aria-label={section.label} className="class-menu__section">
          <p className="class-menu__eyebrow" aria-hidden="true">{section.label}</p>
          {section.rows.map((row) => (
            <MenuItem
              key={row.key}
              className="class-menu__item"
              icon={row.icon}
              selected={row.selected}
              tone={row.tone}
              onSelect={actions[row.key]}
            >
              <RowText title={row.title} hint={row.hint} />
            </MenuItem>
          ))}
        </div>
      ))}
    </Menu>
  );
}
