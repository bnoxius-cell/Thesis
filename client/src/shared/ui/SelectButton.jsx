import { useId } from "react";
import { ChevronDown } from "lucide-react";
import Menu from "./Menu";
import MenuItem from "./MenuItem";
import "./select-button.css";

const joinClasses = (...parts) => parts.filter(Boolean).join(" ");

// A picker: the trigger shows the chosen label and a chevron (Figma SelectButton 37:6) and opens a
// listbox Menu. `options` is [{ value, label }]; onChange gets the chosen value. `native` renders a
// styled <select> instead, which is the better choice for a long list on a phone. `block` fills
// the row. `labelId` is the id of the label that names it (Field passes it). `label` names the
// list itself for screen readers.
export default function SelectButton({
  options,
  value,
  onChange,
  placeholder = "Select",
  native = false,
  block = false,
  labelId,
  label,
  disabled = false,
  className = "",
  ...rest
}) {
  const valueId = useId();
  const chosen = options.find((option) => option.value === value);
  const text = chosen ? chosen.label : placeholder;
  const classes = joinClasses("ui-select", block && "ui-select--block", className);

  if (native) {
    return (
      <span className={joinClasses("ui-select-native", block && "ui-select-native--block")}>
        <select
          className={joinClasses(classes, "ui-select--native")}
          value={chosen ? String(chosen.value) : ""}
          disabled={disabled}
          onChange={(e) => onChange?.(options.find((option) => String(option.value) === e.target.value)?.value)}
          {...rest}
        >
          {!chosen && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="ui-select__chevron" aria-hidden="true" />
      </span>
    );
  }

  return (
    <Menu
      role="listbox"
      matchWidth
      block={block}
      label={label}
      trigger={(menu) => (
        <button
          type="button"
          className={classes}
          disabled={disabled}
          aria-labelledby={labelId ? `${labelId} ${valueId}` : undefined}
          {...rest}
          {...menu}
        >
          <span id={valueId} className={joinClasses("ui-select__value", !chosen && "ui-select__value--empty")}>
            {text}
          </span>
          <ChevronDown size={16} className="ui-select__chevron" aria-hidden="true" />
        </button>
      )}
    >
      {options.map((option) => (
        <MenuItem key={option.value} selected={option.value === value} onSelect={() => onChange?.(option.value)}>
          {option.label}
        </MenuItem>
      ))}
    </Menu>
  );
}
