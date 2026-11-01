import { useLayoutEffect, useMemo, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/shared/ui";
import { buildTimeline } from "../chatTimeline";
import MessageRun from "./MessageRun";

const STICK_PX = 80; // within this far of the bottom counts as "following the chat"

function LoadingMessages() {
  return (
    <div className="people-messages__loading" role="status" aria-label="Loading messages">
      <Skeleton width="60%" height="44px" className="people-messages__skeleton" />
      <Skeleton width="48%" height="44px" className="people-messages__skeleton people-messages__skeleton--mine" />
      <Skeleton width="68%" height="64px" className="people-messages__skeleton" />
    </div>
  );
}

// The chat's scrolling list. It follows new messages while the reader is at the bottom (and when
// they send one), and leaves them alone while they read further up.
export default function MessageList({ items, myId, status, error, onRetry }) {
  const list = useRef(null);
  const following = useRef(true);
  const timeline = useMemo(() => buildTimeline(items, myId), [items, myId]);
  const last = items[items.length - 1];

  useLayoutEffect(() => {
    const el = list.current;
    if (el && (following.current || last?.pending)) el.scrollTop = el.scrollHeight;
  }, [items.length, status, last?.pending]);

  const onScroll = () => {
    const el = list.current;
    following.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
  };

  return (
    <div ref={list} className="people-messages" role="log" aria-label="Messages" tabIndex={0} onScroll={onScroll}>
      {status === "loading" && <LoadingMessages />}
      {status === "failed" && (
        <div className="people-messages__failed" role="alert">
          <p>{error}</p>
          <Button variant="secondary" onClick={onRetry}>Try again</Button>
        </div>
      )}
      {status === "ready" && items.length === 0 && (
        <EmptyState icon={MessageCircle} title="No messages yet" titleAs="p">
          Say hello to start the conversation.
        </EmptyState>
      )}
      {timeline.map((item) =>
        item.kind === "day" ? (
          <div key={item.key} className="people-day">
            <span className="people-day__chip">{item.label}</span>
          </div>
        ) : (
          <MessageRun key={item.key} run={item} />
        ),
      )}
    </div>
  );
}
