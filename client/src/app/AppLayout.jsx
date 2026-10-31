import { useRef } from "react";
import PageArrival from "./PageArrival";
import useFocusMain from "./useFocusMain";
import BottomBar from "./shell/BottomBar";
import FocusViewProvider from "./shell/FocusViewProvider";
import Sidebar from "./shell/Sidebar";
import UnreadProvider from "./shell/UnreadProvider";
import useSidebarCollapsed from "./shell/useSidebarCollapsed";
import "./layout.css";

// The frame for every signed-in page: skip link, the sidebar (from 1024px), the bottom bar (under
// 1024px) and one <main>. Each page draws its own header through <Page> (app/shell).
export default function AppLayout() {
  const main = useRef(null);
  useFocusMain(main);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  return (
    <UnreadProvider>
      <FocusViewProvider>
        <div className="shell-app" data-sidebar={collapsed ? "rail" : undefined}>
          <a className="skip-link" href="#main">Skip to content</a>
          <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
          <main id="main" ref={main} tabIndex={-1} className="shell-main shell-main--app">
            <PageArrival />
          </main>
          <BottomBar />
        </div>
      </FocusViewProvider>
    </UnreadProvider>
  );
}
