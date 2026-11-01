import { useParams, useSearchParams } from "react-router-dom";
import { UsersRound } from "lucide-react";
import { EmptyState } from "@/shared/ui";
import Page from "@/app/shell/Page";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import GroupsPane from "./GroupsPane";
import PeopleAddMenu from "./PeopleAddMenu";
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
// is a placeholder until its own batch.
export default function PeoplePage({ tab = "groups" }) {
  const { groupId } = useParams();
  const [params] = useSearchParams();
  const desktop = useMediaQuery(WIDE);
  const groups = useGroups();
  const groupTab = params.get("tab") === "upcoming" ? "upcoming" : "chat";

  if (!desktop && tab === "groups" && groupId) {
    return <PhoneChat data={groups} groupId={groupId} tab={groupTab} />;
  }

  return (
    <Page title="People" action={<PeopleAddMenu />}>
      <div className="people-body">
        <PeopleTabs tab={tab} block={!desktop} />
        <div role="tabpanel" id="people-panel" aria-labelledby={`people-tab-${tab}`}>
          {tab === "friends" ? (
            <EmptyState icon={UsersRound} title="On its way">
              Your friends and their requests will be here soon.
            </EmptyState>
          ) : (
            <GroupsPane data={groups} groupId={groupId} tab={groupTab} desktop={desktop} />
          )}
        </div>
      </div>
    </Page>
  );
}
