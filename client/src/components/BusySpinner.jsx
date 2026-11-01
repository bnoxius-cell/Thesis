import { Loader2 } from "lucide-react";

// The spinner that goes before a button's label while it saves. Pair it with aria-busy on the
// button: <button aria-busy={saving} disabled={saving}>{saving && <BusySpinner />}Save</button>.
// It spins through the .busy-spinner rule; under reduced motion it holds still.
export default function BusySpinner() {
  return <Loader2 className="busy-spinner" size={16} aria-hidden="true" />;
}
