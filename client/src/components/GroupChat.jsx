import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import {
  ArrowLeft, Send, Smile, ClipboardList, Check, Copy, Users, Clock, BookOpen,
  LogOut, Trash2, ArrowDown, MessageSquare, X, Gauge, CalendarDays, Settings, ShieldCheck,
} from "lucide-react";
import { useAuth } from "../pages/authentication/AuthContext";
import TaskImportDialog from "./TaskImportDialog";
import ScheduleImportDialog from "./schedule/ScheduleImportDialog";
import UserAvatar from "./UserAvatar";
import MemberDialog from "./group/MemberDialog";
import GroupSettingsDialog from "./group/GroupSettingsDialog";

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

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ScheduleCard({ message, onAdd, addedId }) {
  const { schedule, addedByMe } = message;
  const entries = schedule.entries || [];
  const weekdays = [...new Set(entries.flatMap((e) => e.days || []))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  return (
    <div className="chat-task-card chat-schedule-card">
      <div className="chat-task-head">
        <CalendarDays size={16} aria-hidden="true" />
        <span>Shared schedule</span>
      </div>
      <h4>{schedule.title}</h4>
      <p className="chat-task-course">
        {entries.length} {entries.length === 1 ? "entry" : "entries"}
        {weekdays.length > 0 && ` · ${weekdays.map((d) => DAY_SHORT[d]).join(", ")}`}
      </p>
      <ul className="chat-schedule-preview">
        {entries.slice(0, 4).map((e) => <li key={e._id}>{e.title}</li>)}
        {entries.length > 4 && <li className="more">+{entries.length - 4} more</li>}
      </ul>
      {addedByMe ? (
        <span className="chat-task-added">
          <Check size={14} aria-hidden="true" /> In your schedules
          {addedId && <> · <Link to={`/schedule?s=${addedId}`}>Open</Link></>}
        </span>
      ) : (
        <button type="button" className="primary-button small" onClick={() => onAdd(message)}>
          Add to my schedule
        </button>
      )}
    </div>
  );
}

export default function GroupChat({ group, onBack, onLeave, onDelete, onGroupUpdated }) {
  const { backendUrl, user } = useAuth();
  const myId = user?._id;
  const isOwner = group.admin?._id === myId;
  const isAdmin = isOwner || (group.admins || []).includes(myId);
  const roleOf = (id) => (group.admin?._id === id ? "Owner" : (group.admins || []).includes(id) ? "Admin" : null);

  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [copied, setCopied] = useState(false);
  const [memberOpen, setMemberOpen] = useState(null); // member id
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [shareOpen, setShareOpen] = useState(null); // null | "task" | "schedule"
  const [myTasks, setMyTasks] = useState(null); // null = loading
  const [mySchedules, setMySchedules] = useState(null);
  const [sharingId, setSharingId] = useState(null);

  const [pendingTask, setPendingTask] = useState(null);
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [addedSchedules, setAddedSchedules] = useState({}); // message id -> id of the schedule it went into

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
      const message = err.response?.data?.message || "Couldn't send that message.";
      (err.response?.data?.code === "family_filter" ? toast.warn : toast.error)(message);
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
  const openShare = async (kind) => {
    setShareOpen(kind);
    if (kind === "schedule") {
      setMySchedules(null);
      try {
        const { data } = await axios.get(`${backendUrl}/api/schedules`, { withCredentials: true });
        setMySchedules(data.success ? data.schedules.filter((s) => s.role === "owner" && s.entryCount > 0) : []);
      } catch {
        setMySchedules([]);
        toast.error("Couldn't load your schedules.");
      }
      return;
    }
    setMyTasks(null);
    try {
      const { data } = await axios.get(`${backendUrl}/api/tasks`, { withCredentials: true });
      setMyTasks(data.success ? data.tasks.filter((t) => !t.isCompleted) : []);
    } catch {
      setMyTasks([]);
      toast.error("Couldn't load your tasks.");
    }
  };

  const shareSchedule = async (schedule) => {
    if (sharingId) return;
    setSharingId(schedule._id);
    try {
      const { data } = await axios.post(base, { scheduleId: schedule._id }, { withCredentials: true });
      if (data.success) {
        stickRef.current = true;
        mergeMessages([data.message]);
        setShareOpen(null);
        toast.success("Schedule shared with the group.");
      } else {
        toast.error(data.message || "Couldn't share that schedule.");
      }
    } catch (err) {
      (err.response?.data?.code === "family_filter" ? toast.warn : toast.error)(err.response?.data?.message || "Couldn't share that schedule.");
    } finally {
      setSharingId(null);
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
        setShareOpen(null);
        toast.success("Task shared with the group.");
      } else {
        toast.error(data.message || "Couldn't share that task.");
      }
    } catch (err) {
      (err.response?.data?.code === "family_filter" ? toast.warn : toast.error)(err.response?.data?.message || "Couldn't share that task.");
    } finally {
      setSharingId(null);
    }
  };

  // Once a shared task or schedule has been added, the card switches to "In your ...".
  const markTaskAdded = (shareTag) => setMessages((prev) => prev.map((m) => (
    m.task?.shareTag === shareTag ? { ...m, addedByMe: true } : m
  )));
  const markScheduleAdded = (messageId, scheduleId) => {
    setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, addedByMe: true } : m)));
    setAddedSchedules((prev) => ({ ...prev, [messageId]: scheduleId }));
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

  const isCurrentMember = (id) => Boolean(id) && group.members.some((m) => m._id === id);

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
        <UserAvatar name={group.name} src={group.icon} size={38} square />
        <div className="chat-topbar-title">
          <h2>{group.name}</h2>
          <span>
            {group.members.length} {group.members.length === 1 ? "member" : "members"}
            {group.familyFriendly && <em className="family-badge"><ShieldCheck size={12} aria-hidden="true" /> Family-friendly</em>}
          </span>
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
                  ) : isCurrentMember(message.sender?._id) ? (
                    <button type="button" className="chat-avatar-btn" onClick={() => setMemberOpen(message.sender._id)} aria-label={`View ${message.sender.name}`}>
                      <UserAvatar name={message.sender?.name} src={message.sender?.avatar} size={36} />
                    </button>
                  ) : (
                    <UserAvatar name={message.sender?.name} src={message.sender?.avatar} size={36} />
                  )}
                  <div className="chat-content">
                    {!continued && (
                      <div className="chat-meta">
                        {isCurrentMember(message.sender?._id) ? (
                          <button type="button" className="chat-name-btn" onClick={() => setMemberOpen(message.sender._id)}>
                            {message.sender.name}
                          </button>
                        ) : (
                          <strong>{message.sender?.name || "Former member"}</strong>
                        )}
                        {roleOf(message.sender?._id) && <span className={`role-pill role-${roleOf(message.sender._id).toLowerCase()}`}>{roleOf(message.sender._id)}</span>}
                        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                      </div>
                    )}
                    {message.text && <p className="chat-text">{message.text}</p>}
                    {message.type === "task" && <TaskCard message={message} onAdd={setPendingTask} />}
                    {message.type === "schedule" && (
                      <ScheduleCard message={message} onAdd={setPendingSchedule} addedId={addedSchedules[message._id]} />
                    )}
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
              <button type="button" className="chat-icon-btn" onClick={() => openShare("task")} aria-label="Share a task">
                <ClipboardList size={20} />
              </button>
              <button type="button" className="chat-icon-btn" onClick={() => openShare("schedule")} aria-label="Share a schedule">
                <CalendarDays size={20} />
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
            {group.familyFriendly && (
              <span className="chat-filter-hint" title="Messages with swearing or explicit words are blocked in this group">
                <ShieldCheck size={14} aria-hidden="true" /> Family-friendly
              </span>
            )}
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
                  <button type="button" className="chat-member-btn" onClick={() => setMemberOpen(member._id)}>
                    <UserAvatar name={member.name} src={member.avatar} size={28} />
                    <span>{member.name}{member._id === myId ? " (you)" : ""}</span>
                    {roleOf(member._id) && <em>{roleOf(member._id)}</em>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="chat-side-actions">
            {isAdmin && (
              <button type="button" className="chat-settings-btn" onClick={() => setSettingsOpen(true)}>
                <Settings size={15} /> Group settings
              </button>
            )}
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
        <div className="modal-overlay" onClick={() => setShareOpen(null)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="share-title">{shareOpen === "schedule" ? "Share a schedule" : "Share a task"}</h2>
              <button type="button" className="modal-close" onClick={() => setShareOpen(null)} aria-label="Close"><X size={20} /></button>
            </div>

            {shareOpen === "task" && (
              <>
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
              </>
            )}

            {shareOpen === "schedule" && (
              <>
                {mySchedules === null && <p className="chat-state">Loading your schedules...</p>}
                {mySchedules?.length === 0 && (
                  <p className="chat-state">
                    You don't have a schedule with anything in it yet. <Link to="/schedule">Build one</Link> first.
                  </p>
                )}
                {mySchedules?.length > 0 && (
                  <>
                    <p className="chat-state">Groupmates can tap it to add a copy to their own schedules. They can't change yours.</p>
                    <ul className="share-task-list">
                      {mySchedules.map((schedule) => (
                        <li key={schedule._id}>
                          <button type="button" onClick={() => shareSchedule(schedule)} disabled={Boolean(sharingId)}>
                            <strong>{schedule.title}</strong>
                            <span>{schedule.entryCount} {schedule.entryCount === 1 ? "entry" : "entries"}</span>
                            {sharingId === schedule._id && <em>Sharing...</em>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {memberOpen && group.members.some((m) => m._id === memberOpen) && (
        <MemberDialog
          group={group}
          member={group.members.find((m) => m._id === memberOpen)}
          onClose={() => setMemberOpen(null)}
          onGroupUpdated={onGroupUpdated}
        />
      )}

      {settingsOpen && (
        <GroupSettingsDialog group={group} onClose={() => setSettingsOpen(false)} onGroupUpdated={onGroupUpdated} />
      )}

      {pendingTask && (
        <TaskImportDialog
          tag={pendingTask.task.shareTag}
          onClose={() => setPendingTask(null)}
          onImported={() => { markTaskAdded(pendingTask.task.shareTag); setPendingTask(null); }}
        />
      )}

      {pendingSchedule && (
        <ScheduleImportDialog
          source={{ groupId: group._id, messageId: pendingSchedule._id }}
          onClose={() => setPendingSchedule(null)}
          onImported={(added) => { markScheduleAdded(pendingSchedule._id, added._id); setPendingSchedule(null); }}
        />
      )}
    </section>
  );
}
