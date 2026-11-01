import { useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import AddFriendForm from "./AddFriendForm";
import FriendCodeCard from "./FriendCodeCard";
import FriendList from "./FriendList";
import FriendRequests from "./FriendRequests";
import FriendSubtabs from "./FriendSubtabs";
import FriendsStatus from "./FriendsStatus";
import { FRIEND_VIEWS } from "./friendViews";
import SentRequests from "./SentRequests";
import useFriends from "./useFriends";
import "./people-add.css";
import "./people-friends.css";

// The Friends tab (Figma 66:452, 115:922, 115:1091 desktop; 67:1017, 116:1105, 116:1234 phone).
// ?view=requests or ?view=pending picks the sub-tab (none is Friends); ?add=1 focuses the code
// field, which is where the People "+" menu sends "Add a friend". Desktop has the friend code and
// the add form in a column beside the list; a phone has the code above the list (Friends view
// only) and the add form below it. Only the empty Friends page (66:1130) leaves the form out of the
// frame; it is kept here because without it nobody could add a first friend.
export default function FriendsPane({ desktop }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const requested = params.get("view");
  const view = FRIEND_VIEWS.includes(requested) ? requested : "friends";
  const data = useFriends();
  const addRef = useRef(null);
  const { friends, incoming, sent, status } = data;

  const counts = { friends: friends?.length ?? 0, requests: incoming?.length ?? 0, pending: sent?.length ?? 0 };

  let list;
  if (status !== "ready") {
    list = <FriendsStatus status={status} error={data.error} onRetry={data.reload} />;
  } else if (view === "requests") {
    list = <FriendRequests requests={incoming} busyId={data.busyId} onAccept={data.accept} onDecline={data.decline} />;
  } else if (view === "pending") {
    list = <SentRequests requests={sent} busyId={data.busyId} onCancel={data.cancel} />;
  } else {
    list = (
      <FriendList
        friends={friends}
        limit={desktop ? 5 : 4}
        busyId={data.busyId}
        onRemove={data.remove}
        onAdd={() => addRef.current?.focus()}
      />
    );
  }

  return (
    <div className={`people-friends people-friends--${view}`}>
      <div className="people-friends__tabs">
        <FriendSubtabs view={view} counts={counts} />
      </div>
      <div
        role="tabpanel"
        id="people-friends-panel"
        aria-labelledby={`people-subtab-${view}`}
        className="people-friends__list"
        key={view}
      >
        {list}
      </div>
      <div className="people-friends__side">
        <FriendCodeCard />
        <AddFriendForm
          inputRef={addRef}
          focusSignal={params.get("add") === "1" ? location.key : null}
          busy={data.busyId === "add"}
          onSend={data.addByCode}
        />
      </div>
    </div>
  );
}
