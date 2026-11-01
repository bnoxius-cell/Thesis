import { useParams, useSearchParams } from "react-router-dom";
import { UsersRound } from "lucide-react";
import { EmptyState } from "@/shared/ui";
import Page from "@/app/shell/Page";
import GroupsPane from "./GroupsPane";
import PeopleTabs from "./PeopleTabs";
import useGroups from "./useGroups";
import "./people.css";
import "./chat/chat.css";

// People (Figma 64:2): Groups | Friends tabs, then the tab's body. The Groups tab is the list and
// the open group's chat; /people/groups/:groupId opens that group, and ?tab=upcoming its Upcoming
// tab. The Friends tab is a placeholder until its own batch.
export default function PeoplePage({ tab = "groups" }) {
  const { groupId } = useParams();
  const [params] = useSearchParams();
  const groups = useGroups();
  const groupTab = params.get("tab") === "upcoming" ? "upcoming" : "chat";

  return (
    <Page title="People">
      <div className="people-body">
        <PeopleTabs tab={tab} />
        <div role="tabpanel" id="people-panel" aria-labelledby={`people-tab-${tab}`}>
          {tab === "friends" ? (
            <EmptyState icon={UsersRound} title="On its way">
              Your friends and their requests will be here soon.
            </EmptyState>
          ) : (
            <GroupsPane data={groups} groupId={groupId} tab={groupTab} />
          )}
        </div>
      </div>
    </Page>
  );
}
