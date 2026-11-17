import { TriangleAlert } from "lucide-react";

// A short refusal or failure in the server's words, on a soft red box (Figma SH-1 error, SH-2 card error). `action`
// is an optional button that sits at the end of the line.
export default function ErrorNote({ action, children }) {
  return (
    <div className="share-error" role="alert">
      <TriangleAlert size={20} aria-hidden="true" />
      <p>{children}</p>
      {action}
    </div>
  );
}
