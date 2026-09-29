import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import {
  ArrowLeft, Send, Smile, ClipboardList, Check, Copy, Users, Clock, BookOpen,
  LogOut, Trash2, ArrowDown, MessageSquare, X, Gauge,
} from "lucide-react";
import { useAuth } from "../pages/authentication/AuthContext";
import ConfirmDialog from "./ConfirmDialog";

const POLL_INTERVAL_MS = 3000;
const MAX_LENGTH = 1000;
const GROUP_WINDOW_MS = 5 * 60 * 1000; // messages this close together share one header
const EMOJIS = ["👍", "😀", "😂", "❤️", "🎉"];

const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const formatDay = (iso) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
};

const formatDue = (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

function Avatar({ name, src }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img className="chat-avatar" src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <span className="chat-avatar chat-avatar-fallback" aria-hidden="true">{(name || "?").trim().charAt(0).toUpperCase()}</span>;
}

function TaskCard({ message, onAdd }) {
  const { task, addedByMe } = message;
  return (
    <div className="chat-task-card">
      <div className="chat-task-head">
        <ClipboardList size={16} aria-hidden="true" />
        <span>Shared task</span>
      </div>
      <h4>{task.title}</h4>
      <p className="chat-task-course"><BookOpen size={14} aria-hidden="true" /> {task.course}</p>
      <div className="chat-task-meta">
        <span><Clock size={13} aria-hidden="true" /> Due {formatDue(task.dueDate)}</span>
        <span>{task.hours}h estimated</span>
        <span><Gauge size={13} aria-hidden="true" /> Difficulty {task.difficulty}/5</span>
      </div>
      {task.description && <p className="chat-task-desc">{task.description}</p>}
      {addedByMe ? (
        <span className="chat-task-added"><Check size={14} aria-hidden="true" /> In your schedule</span>
      ) : (
        <button type="button" className="primary-button small" onClick={() => onAdd(message)}>
          Add to my schedule
        </button>
      )}
    </div>
  );
}

export default function GroupChat({ group, onBack, onLeave, onDelete }) {
  const { backendUrl, user } = useAuth();
  const myId = user?._id;
  const isOwner = group.admin?._id === myId;

  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [copied, setCopied] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [myTasks, setMyTasks] = useState(null); // null = loading
  const [sharingId, setSharingId] = useState(null);

  const [pendingTask, setPendingTask] = useState(null);
  const [adding, setAdding] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const emojiRef = useRef(null);
  const stickRef = useRef(true); // true while the reader is at the bottom of the chat
  const lastIdRef = useRef(null);
  const busyRef = useRef(false);
  const knownIdsRef = useRef(new Set());

  const base = `${backendUrl}/api/groups/${group._id}/messages`;

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setUnseen(0);
  }, []);

  // Adds messages we haven't seen yet. Poll results can overlap with a message we
  // just sent ourselves, so dedupe by id. Only polled messages move the poll cursor:
  // if our own send did, a teammate's message posted just before it would be skipped.
  const mergeMessages = useCallback((incoming, { fromPoll = false } = {}) => {
    if (fromPoll && incoming.length) lastIdRef.current = incoming[incoming.length - 1]._id;
    const fresh = incoming.filter((m) => !knownIdsRef.current.has(m._id));
    if (!fresh.length) return;
    fresh.forEach((m) => knownIdsRef.current.add(m._id));
    if (!stickRef.current) setUnseen((n) => n + fresh.filter((m) => m.sender?._id !== myId).length);
    // ObjectIds sort by creation time, so this keeps the chat in order even if a
    // teammate's message arrives after one we just sent.
    setMessages((prev) => [...prev, ...fresh].sort((x, y) => (x._id < y._id ? -1 : 1)));
  }, [myId]);

  const poll = useCallback(async () => {
    if (busyRef.current || document.hidden) return;
    busyRef.current = true;
    try {
      const url = lastIdRef.current ? `${base}?after=${lastIdRef.current}` : base;
      const { data } = await axios.get(url, { withCredentials: true });
      if (data.success) {
        mergeMessages(data.messages, { fromPoll: true });
        setStatus("ready");
      }
    } catch {
      // Keep polling through a blip; only give up if the first load never worked.
      setStatus((s) => (s === "loading" ? "error" : s));
    } finally {
      busyRef.current = false;
    }
  }, [base, mergeMessages]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  // Follow the conversation while the reader is at the bottom.
  useEffect(() => {
    if (stickRef.current) scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (stickRef.current) setUnseen(0);
  };

  // Close the emoji popover on outside click or Escape.
  useEffect(() => {
    if (!emojiOpen) return undefined;
    const onDown = (e) => { if (!emojiRef.current?.contains(e.target)) setEmojiOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setEmojiOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [emojiOpen]);

  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  useEffect(resizeInput, [draft]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { data } = await axios.post(base, { text }, { withCredentials: true });
      if (data.success) {
        stickRef.current = true;
        mergeMessages([data.message]);
        setDraft("");
      } else {
        toast.error(data.message || "Couldn't send that message.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't send that message.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  const insertEmoji = (emoji) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    if (next.length > MAX_LENGTH) return;
    setDraft(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + emoji.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  // Share a task
  const openShare = async () => {
    setShareOpen(true);
    setMyTasks(null);
    try {
      const { data } = await axios.get(`${backendUrl}/api/tasks`, { withCredentials: true });
      setMyTasks(data.success ? data.tasks.filter((t) => !t.isCompleted) : []);
    } catch {
      setMyTasks([]);
      toast.error("Couldn't load your tasks.");
    }
  };

  const shareTask = async (task) => {
    if (sharingId) return;
    setSharingId(task._id);
    try {
      const { data } = await axios.post(base, { taskId: task._id }, { withCredentials: true });
      if (data.success) {
        stickRef.current = true;
        mergeMessages([data.message]);
        setShareOpen(false);
        toast.success("Task shared with the group.");
      } else {
        toast.error(data.message || "Couldn't share that task.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't share that task.");
    } finally {
      setSharingId(null);
    }
  };

  // Add a shared task to my own schedule (after the confirm dialog)
  const confirmAdd = async () => {
    if (!pendingTask || adding) return;
    setAdding(true);
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/tasks/import`,
        { shareTag: pendingTask.task.shareTag },
        { withCredentials: true }
      );
      if (data.success) {
        setMessages((prev) => prev.map((m) => (
          m.task?.shareTag === pendingTask.task.shareTag ? { ...m, addedByMe: true } : m
        )));
        toast.success("Added to your schedule.");
        setPendingTask(null);
      } else {
        toast.error(data.message || "Couldn't add that task.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't add that task.");
    } finally {
      setAdding(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(group.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info(`Join code: ${group.joinCode}`);
    }
  };

  // Flatten messages into day dividers + message rows, marking which rows start
  // a new run from the same sender (those get the avatar and name).
  const rows = useMemo(() => {
    const out = [];
    let prev = null;
    messages.forEach((m) => {
      const day = new Date(m.createdAt).toDateString();
      if (!prev || new Date(prev.createdAt).toDateString() !== day) {
        out.push({ kind: "day", key: `day-${m._id}`, label: formatDay(m.createdAt) });
        prev = null;
      }
      const continued = prev
        && prev.sender?._id === m.sender?._id
        && prev.type === "text" && m.type === "text"
        && new Date(m.createdAt) - new Date(prev.createdAt) < GROUP_WINDOW_MS;
      out.push({ kind: "message", key: m._id, message: m, continued: Boolean(continued) });
      prev = m;
    });
    return out;
  }, [messages]);

  return (
    <section className="chat-shell" aria-label={`${group.name} chat`}>
      <header className="chat-topbar">
        <button type="button" className="chat-icon-btn" onClick={onBack} aria-label="Back to groups">
          <ArrowLeft size={18} />
        </button>
        <div className="chat-topbar-title">
          <h2>{group.name}</h2>
          <span>{group.members.length} {group.members.length === 1 ? "member" : "members"}</span>
        </div>
        <button
          type="button"
          className={`chat-icon-btn chat-info-toggle${infoOpen ? " is-active" : ""}`}
          onClick={() => setInfoOpen((o) => !o)}
          aria-label="Toggle group info"
          aria-expanded={infoOpen}
        >
          <Users size={18} />
        </button>
      </header>

      <div className="chat-body">
        <div className="chat-main">
          <div className="chat-messages" ref={listRef} onScroll={handleScroll} aria-live="polite">
            {status === "loading" && <p className="chat-state">Loading messages...</p>}
            {status === "error" && (
              <p className="chat-state">
                Couldn't load this chat. Check your connection and{" "}
                <button type="button" className="chat-link-btn" onClick={() => { setStatus("loading"); poll(); }}>try again</button>.
              </p>
            )}
            {status === "ready" && messages.length === 0 && (
              <div className="chat-empty">
                <MessageSquare size={28} aria-hidden="true" />
                <p>No messages yet. Say hi, or share a task to get the group started.</p>
              </div>
            )}

            {rows.map((row) => {
              if (row.kind === "day") {
                return <div key={row.key} className="chat-day"><span>{row.label}</span></div>;
              }
              const { message, continued } = row;
              const mine = message.sender?._id === myId;
              return (
                <div key={row.key} className={`chat-row${continued ? " is-continued" : ""}${mine ? " is-mine" : ""}`}>
                  {continued ? (
                    <span className="chat-time-gutter">{formatTime(message.createdAt)}</span>
                  ) : (
                    <Avatar name={message.sender?.name} src={message.sender?.avatar} />
                  )}
                  <div className="chat-content">
                    {!continued && (
                      <div className="chat-meta">
                        <strong>{message.sender?.name || "Former member"}</strong>
                        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                      </div>
                    )}
                    {message.text && <p className="chat-text">{message.text}</p>}
                    {message.type === "task" && <TaskCard message={message} onAdd={setPendingTask} />}
                  </div>
                </div>
              );
            })}
          </div>

          {unseen > 0 && (
            <button type="button" className="chat-jump" onClick={() => { stickRef.current = true; scrollToBottom(); }}>
              <ArrowDown size={14} /> {unseen} new {unseen === 1 ? "message" : "messages"}
            </button>
          )}

          <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
            <div className="chat-composer-tools">
              <div className="chat-emoji-wrap" ref={emojiRef}>
                <button
                  type="button"
                  className="chat-icon-btn"
                  onClick={() => setEmojiOpen((o) => !o)}
                  aria-label="Add emoji"
                  aria-expanded={emojiOpen}
                >
                  <Smile size={20} />
                </button>
                {emojiOpen && (
                  <div className="chat-emoji-pop" role="menu">
                    {EMOJIS.map((emoji) => (
                      <button key={emoji} type="button" role="menuitem" onClick={() => insertEmoji(emoji)} aria-label={`Insert ${emoji}`}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" className="chat-icon-btn" onClick={openShare} aria-label="Share a task">
                <ClipboardList size={20} />
              </button>
            </div>
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={MAX_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Message ${group.name}`}
              aria-label="Write a message"
            />
            {draft.length > MAX_LENGTH * 0.8 && (
              <span className="chat-counter">{draft.length}/{MAX_LENGTH}</span>
            )}
            <button type="submit" className="chat-send" disabled={!draft.trim() || sending} aria-label="Send message">
              <Send size={18} />
            </button>
          </form>
        </div>

        <aside className={`chat-sidebar${infoOpen ? " is-open" : ""}`}>
          {group.description && <p className="chat-side-desc">{group.description}</p>}
          <div className="chat-side-block">
            <span className="chat-side-label">Join code</span>
            <button type="button" className="chat-code" onClick={copyCode} aria-label="Copy join code">
              <strong>{group.joinCode}</strong>
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
            <small>{copied ? "Copied" : "Share this so classmates can join."}</small>
          </div>
          <div className="chat-side-block">
            <span className="chat-side-label">Members ({group.members.length})</span>
            <ul className="chat-members">
              {group.members.map((member) => (
                <li key={member._id}>
                  <Avatar name={member.name} src={member.avatar} />
                  <span>{member.name}{member._id === myId ? " (you)" : ""}</span>
                  {member._id === group.admin?._id && <em>Owner</em>}
                </li>
              ))}
            </ul>
          </div>
          <div className="chat-side-actions">
            {isOwner ? (
              <button type="button" className="chat-danger-btn" onClick={onDelete}>
                <Trash2 size={15} /> Delete group
              </button>
            ) : (
              <button type="button" className="chat-danger-btn" onClick={onLeave}>
                <LogOut size={15} /> Leave group
              </button>
            )}
          </div>
        </aside>
      </div>

      {shareOpen && (
        <div className="modal-overlay" onClick={() => setShareOpen(false)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="share-task-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="share-task-title">Share a task</h2>
              <button type="button" className="modal-close" onClick={() => setShareOpen(false)} aria-label="Close"><X size={20} /></button>
            </div>
            {myTasks === null && <p className="chat-state">Loading your tasks...</p>}
            {myTasks?.length === 0 && (
              <p className="chat-state">
                You don't have any open tasks to share. <Link to="/create-task">Create one</Link> first.
              </p>
            )}
            {myTasks?.length > 0 && (
              <ul className="share-task-list">
                {myTasks.map((task) => (
                  <li key={task._id}>
                    <button type="button" onClick={() => shareTask(task)} disabled={Boolean(sharingId)}>
                      <strong>{task.title}</strong>
                      <span>{task.course} · Due {formatDue(task.dueDate)}</span>
                      {sharingId === task._id && <em>Sharing...</em>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingTask)}
        title="Add to your schedule?"
        confirmLabel="Add task"
        busy={adding}
        onConfirm={confirmAdd}
        onCancel={() => setPendingTask(null)}
      >
        {pendingTask && (
          <p>
            <strong>{pendingTask.task.title}</strong> ({pendingTask.task.course}), due{" "}
            {formatDue(pendingTask.task.dueDate)}, will be added to your own schedule.
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}
