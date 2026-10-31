import { Plus } from "lucide-react";
import "./add-button.css";

// The round "+" that opens a page's add flow. `label` names what it adds ("Add a reviewer").
export default function AddButton({ label, type = "button", className = "", ...rest }) {
  return (
    <button type={type} className={`ui-add-btn ${className}`.trim()} aria-label={label} {...rest}>
      <span className="ui-add-btn__face">
        <Plus size={20} strokeWidth={2.25} aria-hidden="true" />
      </span>
    </button>
  );
}
