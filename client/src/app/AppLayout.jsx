import { useRef } from "react";
import PageArrival from "./PageArrival";
import useFocusMain from "./useFocusMain";
import Sidebar from "./shell/Sidebar";
import UnreadProvider from "./shell/UnreadProvider";
import "./layout.css";

// The frame for every signed-in page: skip link, the sidebar (from 1024px) and one <main>. Each page
// draws its own header through <Page> (app/shell). The phone bars arrive with F5.
export default function AppLayout() {
  const main = useRef(null);
  useFocusMain(main);
  return (
    <UnreadProvider>
      <div className="shell-app">
        <a className="skip-link" href="#main">Skip to content</a>
        <Sidebar />
        <main id="main" ref={main} tabIndex={-1} className="shell-main shell-main--app">
          <PageArrival />
        </main>
      </div>
    </UnreadProvider>
  );
}
