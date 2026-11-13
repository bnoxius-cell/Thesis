import { useParams, useSearchParams } from "react-router-dom";
import Page from "@/app/shell/Page";
import { useGlobalAdd } from "@/app/shell/add/addContext";
import useAddHere from "@/app/shell/add/useAddHere";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import FriendsPane from "./FriendsPane";
import GroupsPane from "./GroupsPane";
import PeopleTabs from "./PeopleTabs";
import PhoneChat from "./PhoneChat";
import useGroups from "./useGroups";
import "./people.css";
import "./chat/chat.css";
import "./chat/chat-cards.css";

const WIDE = "(min-width: 1024px)"; // where the sidebar appears and the two panes fit

// People (Figma 64:2 desktop, 67:818 phone): Groups | Friends tabs, then the tab's body. The Groups
// tab is the list and the open group's chat; /people/groups/:groupId opens that group, and
// ?tab=upcoming its Upcoming tab. On a phone an open group is a screen of its own. The Friends tab
// is FriendsPane.
export default function PeoplePage({ tab = "groups" }) {
  const { groupId } = useParams();
  const [params] = useSearchParams();
  const desktop = useMediaQuery(WIDE);
  const groups = useGroups();
  const groupTab = params.get("tab") === "upcoming" ? "upcoming" : "chat";
  const { open } = useGlobalAdd();
  const onNewGroup = () => open("group");
  const onJoinGroup = () => open("join");

  // A group was just made or joined from the global Add: bring the list up to date, so the toast's View finds it.
  useAddHere({ onAdded: (kind) => (kind === "group" || kind === "join") && groups.refresh() });

  if (!desktop && tab === "groups" && groupId) {
    return <PhoneChat data={groups} groupId={groupId} tab={groupTab} />;
  }

  return (
    <Page title="People">
      <div className="people-body">
        <PeopleTabs tab={tab} block={!desktop} />
        <div role="tabpanel" id="people-panel" aria-labelledby={`people-tab-${tab}`}>
          {tab === "friends" ? (
            <FriendsPane desktop={desktop} />
          ) : (
            <GroupsPane data={groups} groupId={groupId} tab={groupTab} desktop={desktop} onNewGroup={onNewGroup} onJoinGroup={onJoinGroup} />
          )}
        </div>
      </div>
    </Page>
  );
}
