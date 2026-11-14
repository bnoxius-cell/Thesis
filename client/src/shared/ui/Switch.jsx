import "./switch.css";

// An on/off switch that saves the moment it flips (Figma Components > Switch). Name it with `label`
// (aria-label) or `labelId` (the id of a visible label). The 44px button is the hit area; the
// 40x24 track inside is what shows.
export default function Switch({ checked, onChange, label, labelId, describedBy, disabled = false, className = "", ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      disabled={disabled}
      className={`ui-switch ${className}`.trim()}
      onClick={() => onChange?.(!checked)}
      {...rest}
    >
      <span className="ui-switch__track" aria-hidden="true">
        <span className="ui-switch__knob" />
      </span>
    </button>
  );
}
