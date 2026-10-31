import { useRef } from "react";
import PageArrival from "./PageArrival";
import useFocusMain from "./useFocusMain";
import "./layout.css";

// The frame for every signed-in page: skip link and one <main>. F4 adds the sidebar and header.
export default function AppLayout() {
  const main = useRef(null);
  useFocusMain(main);
  return (
    <div className="shell-app">
      <a className="skip-link" href="#main">Skip to content</a>
      <main id="main" ref={main} tabIndex={-1} className="shell-main">
        <PageArrival />
      </main>
    </div>
  );
}
