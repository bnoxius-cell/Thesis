import { useRef } from "react";
import PageArrival from "./PageArrival";
import useFocusMain from "./useFocusMain";
import "./layout.css";

// Full-screen tasks (practice, check-in) with no navigation around them. The page itself offers Exit.
export default function FocusLayout() {
  const main = useRef(null);
  useFocusMain(main, { onMount: true });
  return (
    <main id="main" ref={main} tabIndex={-1} className="shell-main shell-main--focus">
      <PageArrival />
    </main>
  );
}
