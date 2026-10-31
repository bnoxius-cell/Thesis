import { selectOnArrowKey } from "./rovingKeys";
import "./segment.css";

// A radio group drawn as a pill track with a sliding thumb (Figma Segment, in the Pace switch of
// 53:909). `options` is [{ value, label }]. Arrow keys, Home and End move and select. Name it with
// `label` (aria-label) or `labelId` (the id of a visible label; Field passes it).
export default function Segment({ options, value, onChange, label, labelId, disabled = false, className = "", ...rest }) {
  const index = options.findIndex((option) => option.value === value);
  const style = { "--count": options.length, "--index": Math.max(index, 0) };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelId}
      className={`ui-segment ${className}`.trim()}
      style={style}
      data-empty={index < 0 || undefined}
      onKeyDown={(e) => selectOnArrowKey(e, '[role="radio"]')}
      {...rest}
    >
      <span className="ui-segment__thumb" aria-hidden="true" />
      {options.map((option, i) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={i === index}
          tabIndex={i === Math.max(index, 0) ? 0 : -1}
          disabled={disabled}
          className="ui-segment__option"
          onClick={() => onChange?.(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
