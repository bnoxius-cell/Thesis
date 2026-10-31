import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import PageFallback from "./PageFallback";

// The routed page inside a layout, with its code-loading skeleton. It is keyed on the first path
// segment, so moving between sections (Home to Plan) replays the quiet arrival (layout.css) while
// moving inside one (a group in People, a tab) does not reset the page.
export default function PageArrival() {
  const section = useLocation().pathname.split("/")[1] || "";
  return (
    <div key={section} className="shell-page">
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
