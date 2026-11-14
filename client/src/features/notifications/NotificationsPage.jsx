import { useLocation, useNavigate } from "react-router-dom";
import Page from "@/app/shell/Page";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import InboxActions from "./InboxActions";
import InboxPanel from "./InboxPanel";
import useInbox from "./useInbox";
import "./notifications.css";

// /notifications (Figma 298:2810 phone, 298:2990 empty): the inbox as a page. Phones reach it from the
// bell and get a back arrow; on a wide screen it is where a push notification opens, with the same
// panel the drawer shows.
export default function NotificationsPage() {
  const phone = useMediaQuery("(max-width: 1023px)");
  const navigate = useNavigate();
  const cameFromHere = useLocation().key !== "default"; // false on a fresh load, where there is nothing to go back to
  const inbox = useInbox();

  // Back goes to the page the student came from; with no history it falls back to Home.
  const back = {
    to: "/home",
    label: "Back",
    onClick: cameFromHere
      ? (e) => {
          e.preventDefault();
          navigate(-1);
        }
      : undefined,
  };

  return (
    <Page title="Notifications" back={phone ? back : undefined}>
      <div className="inbox-page">
        <InboxPanel inbox={inbox} toolbar={<InboxActions inbox={inbox} />} />
      </div>
    </Page>
  );
}
