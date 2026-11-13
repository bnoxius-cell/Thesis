import { useRef } from "react";
import PageArrival from "./PageArrival";
import useFocusMain from "./useFocusMain";
import AddProvider from "./shell/add/AddProvider";
import BottomBar from "./shell/BottomBar";
import FocusViewProvider from "./shell/FocusViewProvider";
import Sidebar from "./shell/Sidebar";
import SiteFooter from "./shell/SiteFooter";
import UnreadProvider from "./shell/UnreadProvider";
import useSidebarCollapsed from "./shell/useSidebarCollapsed";
import WhatsNewWindow from "@/features/whats-new/WhatsNewWindow";
import "./layout.css";

// The frame for every signed-in page: skip link, the sidebar (from 1024px), the bottom bar (under
// 1024px) and one <main> that ends in the site footer. Each page draws its own header through <Page> (app/shell).
export default function AppLayout() {
  const main = useRef(null);
  useFocusMain(main);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  return (
    <UnreadProvider>
      <FocusViewProvider>
        <AddProvider>
          <div className="shell-app" data-sidebar={collapsed ? "rail" : undefined}>
            <a className="skip-link" href="#main">Skip to content</a>
            <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
            <main id="main" ref={main} tabIndex={-1} className="shell-main shell-main--app">
              <PageArrival />
              <SiteFooter />
            </main>
            <BottomBar />
            <WhatsNewWindow />
          </div>
        </AddProvider>
      </FocusViewProvider>
    </UnreadProvider>
  );
}
