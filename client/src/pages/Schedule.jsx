import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Plus, Link2, Share2, Trash2, LogOut, CalendarDays, Star, Download, X, ChevronDown, ChevronRight, ChevronsUpDown,
  MoreHorizontal, Copy, Palette, Pencil, Lock, Users, Globe2, ClipboardList, BookOpen, PenTool, Sparkles,
  PartyPopper, Eye, Check, LayoutList,
} from "lucide-react";
import AppShell, { ShellOverlays } from "../components/layout/AppShell";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import TaskImportDialog from "../components/TaskImportDialog";
import MonthView from "../components/schedule/MonthView";
import HolidayCalendar from "../components/schedule/HolidayCalendar";
import TasksTab from "../components/schedule/TasksTab";
import Tabs from "../components/Tabs";
import EntryModal from "../components/schedule/EntryModal";
import EntryDetails from "../components/schedule/EntryDetails";
import TaskModal from "../components/schedule/TaskModal";
import { focusTaskCheck, showDoneToast } from "../utils/taskDone";
import DayMarkModal from "../components/schedule/DayMarkModal";
import ShareModal from "../components/schedule/ShareModal";
import ScheduleImportDialog from "../components/schedule/ScheduleImportDialog";
import ScheduleActivity from "../components/schedule/ScheduleActivity";
import Menu, { MenuItem } from "../components/schedule/Menu";
import { useAuth } from "./authentication/AuthContext";
import useWorkload from "../utils/useWorkload";
import { useTabParam } from "../utils/useTabParam";
import {
  SCHEDULE_THEMES, normalizeTheme, monthOfWeek, monthWeeks, addDays, toISODate, fromISODate, taskDueIso,
} from "../utils/scheduleUtils";
import { SCHEDULE_TOUR } from "../utils/tours";
import "../App.css";
import "../styles/pages/schedule.css";
import Modal from "../components/Modal";
import BusySpinner from "../components/BusySpinner";

// How often an open schedule checks for changes made by others. The check is tiny; the full
// schedule is only downloaded again when it says something changed.
const LIVE_CHECK_MS = 4000;

// Three presets as radio buttons. Older theme keys arrive already mapped (normalizeTheme), so
// a schedule saved as "cute" shows Lavender selected.
function ThemePicker({ value, disabled, onChange }) {
  const current = normalizeTheme(value);
  return (
    <div className="sched-theme-picker" role="radiogroup" aria-label="Schedule theme">
      {SCHEDULE_THEMES.map((t) => {
        const on = current === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={on}
            className={`sched-theme-option${on ? " is-selected" : ""}`}
            data-sched-theme={t.key}
            disabled={disabled}
            onClick={() => onChange(t.key)}
          >
            <span className="sched-theme-preview" aria-hidden="true">
              {t.swatch.map((c) => <i key={c} style={{ background: c }} />)}
            </span>
            <span className="sched-theme-name">{t.label}</span>
            {on && <Check size={16} aria-hidden="true" className="sched-theme-check" />}
          </button>
        );
      })}
    </div>
  );
}

// Who the schedule belongs to and how open it is, as two quiet chips under the title (like the
// lock or globe in Google Docs).
function AccessChips({ schedule }) {
  const { people = 0, link = "restricted" } = schedule.access || {};
  const isOwner = schedule.role === "owner";
  const whose = isOwner
    ? (schedule.isMain ? "Main schedule" : "Extra schedule")
    : `Shared by ${schedule.owner?.name || "a friend"}`;
  let Icon;
  let access;
  if (!isOwner) {
    Icon = schedule.role === "editor" ? Pencil : Eye;
    access = `${schedule.role === "editor" ? "You can edit" : "View only"}${people > 0 ? ` · ${people + 1} people` : ""}`;
  } else if (people === 0 && link === "restricted") {
    Icon = Lock;
    access = "Private";
  } else {
    Icon = link === "restricted" ? Users : Globe2;
    const sharedWith = people > 0 ? `Shared with ${people}` : "Not shared yet";
    access = link === "restricted" ? sharedWith : `${sharedWith} · anyone with the code can ${link === "editor" ? "edit" : "view"}`;
  }
  return (
    <p className="sched-chips">
      <span className="chip is-neutral">{isOwner && schedule.isMain ? <Star size={14} aria-hidden="true" /> : <CalendarDays size={14} aria-hidden="true" />}{whose}</span>
      <span className="chip is-neutral sched-access"><Icon size={14} aria-hidden="true" />{access}</span>
    </p>
  );
}

// The rows on the "All schedules" page: a tile in the schedule's own accent, the name, one line
// of meta, a chip, and an arrow. The whole row opens the schedule.
function ScheduleRow({ schedule, chip, meta, onOpen, children }) {
  return (
    <li className="sched-row" data-sched-theme={normalizeTheme(schedule.theme)}>
      <button type="button" className="sched-row-main" onClick={onOpen}>
        <span className="sched-row-tile" aria-hidden="true">
          {schedule.role !== "owner" ? <Users size={18} /> : schedule.isMain ? <Star size={18} /> : <CalendarDays size={18} />}
        </span>
        <span className="sched-row-text">
          <strong>{schedule.title}</strong>
          <small>{meta}</small>
        </span>
        {chip && <span className="chip is-neutral">{chip}</span>}
        {!children && <ChevronRight size={18} aria-hidden="true" className="sched-row-arrow" />}
      </button>
      {children}
    </li>
  );
}

const entryCountLabel = (n) => `${n} ${n === 1 ? "entry" : "entries"}`;
const sharingLabel = (s) => (s.private ? "Private" : s.collaboratorCount > 0 ? `Shared with ${s.collaboratorCount}` : "Shared by code");

const dayCountLabel = (n) => `${n} ${n === 1 ? "day" : "days"}`;

export default function Schedule() {
  const { backendUrl, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get("s");

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTheme, setNewTheme] = useState("classic");
  const [joinCode, setJoinCode] = useState("");
  const [importSource, setImportSource] = useState(null); // what the "add to my schedule" dialog is showing
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Schedules shared with you can be dismissed, which just removes your view of them.
  const [dismissing, setDismissing] = useState(null);
  // The owner's main schedule, only loaded while looking at one of their extras, to flag overlaps.
  const [mainInfo, setMainInfo] = useState(null); // { forId, entries }

  // Both are tied to the id they belong to, so switching schedules never shows the
  // previous one (or its error) while the next loads.
  const [loadedSchedule, setSchedule] = useState(null);
  const [failedId, setFailedId] = useState(null);
  const schedule = loadedSchedule?._id === openId ? loadedSchedule : null;
  const detailFailed = failedId === openId;
  // The month on show (first of the month), shared by the Week and Days off tabs.
  const [month, setMonth] = useState(() => monthOfWeek(new Date()));
  const [holidayCache, setHolidayCache] = useState({}); // year -> [{date, name}]
  const [holidayError, setHolidayError] = useState("");

  // The signed-in person's own tasks. They show on their schedules under the day they are due,
  // and nobody else on a shared schedule ever sees them.
  const { tasks, setTasks, week, now } = useWorkload();
  const [taskModal, setTaskModal] = useState(null); // { task?, date? }
  const [taskCode, setTaskCode] = useState(null); // 6-digit code being previewed

  const [entryModal, setEntryModal] = useState(null); // { entry?, kind, date? }
  const [detailsEntry, setDetailsEntry] = useState(null);
  const [markDate, setMarkDate] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // { kind: "delete" | "leave" | "entry" | "task", entry?, task? }
  const [confirming, setConfirming] = useState(false);

  // Bumped after every save, so a slow background refresh that started earlier can't
  // land afterwards and overwrite what the user just changed.
  const mutationVersion = useRef(0);
  // Holiday years already asked for, so a re-render (or Strict Mode's double effect run)
  // never asks for the same year twice.
  const holidayRequests = useRef(new Set());
  // The last version of the open schedule we have, and the newest change in its log we've seen.
  const lastStamp = useRef(null);
  const seenActivity = useRef(null);

  const api = `${backendUrl}/api/schedules`;
  const role = schedule?.role;
  // Viewers can only look and copy. Editors change the entries and days off for everybody on a
  // shared schedule. Settings and deleting stay with the owner.
  const isOwner = role === "owner";
  const isEditor = role === "editor";
  const canEdit = isOwner || isEditor;
  // Your tasks appear on schedules that are your week: your own, or a shared one you count.
  const tasksHere = Boolean(schedule && (isOwner || schedule.myCountInWorkload));
  const tabIds = tasksHere ? ["week", "tasks", "days-off"] : ["week", "days-off"];
  const [tab, setTab] = useTabParam(tabIds);

  // ---- Links: ?share= (old friend-share notes), ?code= (a shared link) --------

  const shareParam = searchParams.get("share");
  const codeParam = searchParams.get("code");
  useEffect(() => {
    if (shareParam) {
      // Shared schedules open directly now, like a Google Doc.
      setSearchParams({ s: shareParam }, { replace: true });
    } else if (codeParam) {
      setImportSource({ shareCode: codeParam.trim().toUpperCase() });
      const next = new URLSearchParams(searchParams);
      next.delete("code");
      setSearchParams(next, { replace: true });
    }
  }, [shareParam, codeParam, searchParams, setSearchParams]);

  // ---- Tasks -------------------------------------------------------------


  const openTasks = tasks
    .filter((t) => !t.isCompleted)
    .map((t) => ({ ...t, dueIso: taskDueIso(t.dueDate) }));

  // ---- List --------------------------------------------------------------

  const fetchList = useCallback(async () => {
    try {
      const { data } = await axios.get(api, { withCredentials: true });
      if (data.success) {
        setSchedules(data.schedules);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [api]);

  // The list also feeds the schedule switcher next to an open schedule's name.
  useEffect(() => {
    fetchList();
  }, [openId, fetchList]);

  // ---- Detail ------------------------------------------------------------

  const leaveDetail = useCallback((message) => {
    toast.error(message);
    setSearchParams({ view: "all" });
  }, [setSearchParams]);

  const fetchDetail = useCallback(async ({ quiet } = {}) => {
    const startedAt = mutationVersion.current;
    try {
      const { data } = await axios.get(`${api}/${openId}`, { withCredentials: true });
      if (startedAt !== mutationVersion.current) return;
      if (data.success) {
        setSchedule(data.schedule);
        setFailedId(null);
      } else if (!quiet) {
        setFailedId(openId);
      }
    } catch (err) {
      if ([403, 404].includes(err.response?.status)) {
        leaveDetail("That schedule isn't available anymore. It may have been deleted or made private.");
      } else if (!quiet) {
        setFailedId(openId);
      }
    }
  }, [api, openId, leaveDetail]);

  useEffect(() => {
    if (!openId) return undefined;
    lastStamp.current = null;
    seenActivity.current = null;
    fetchDetail();
    // Pick up edits from anyone else on the same schedule within a few seconds.
    const check = async () => {
      if (document.hidden || !lastStamp.current) return;
      try {
        const { data } = await axios.get(`${api}/${openId}/stamp`, { withCredentials: true });
        if (data.success && data.updatedAt !== lastStamp.current) fetchDetail({ quiet: true });
      } catch (err) {
        // Only the API's own answer means access is gone. A bare 404 (an older server without
        // this route, mid-deploy) is ignored and the page simply stops auto-refreshing.
        if ([403, 404].includes(err.response?.status) && err.response?.data?.success === false) {
          leaveDetail("You no longer have access to that schedule.");
        }
      }
    };
    const id = setInterval(check, LIVE_CHECK_MS);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", check);
    };
  }, [openId, api, fetchDetail, leaveDetail]);

  // Remember the version we have, and tell the person when someone else changed something.
  useEffect(() => {
    if (!schedule) return;
    lastStamp.current = schedule.updatedAt;
    const log = schedule.activity || [];
    const newest = log[log.length - 1]?._id || null;
    if (seenActivity.current !== null && newest !== seenActivity.current) {
      const from = log.findIndex((a) => a._id === seenActivity.current);
      const fresh = log.slice(from + 1).filter((a) => String(a.user) !== String(user?._id));
      if (fresh.length === 1) toast.info(`${fresh[0].userName || "Someone"} ${fresh[0].summary}.`);
      else if (fresh.length > 1) toast.info(`${fresh.length} new changes from others. See "What changed" below.`);
    }
    seenActivity.current = newest ?? "";
  }, [schedule, user?._id]);

  const scheduleId = schedule?._id;
  const needsMain = Boolean(schedule && schedule.role === "owner" && !schedule.isMain);
  useEffect(() => {
    if (!needsMain) return undefined;
    let cancelled = false;
    axios.get(`${api}/main`, { withCredentials: true })
      .then(({ data }) => { if (!cancelled && data.success && data.schedule) setMainInfo({ forId: scheduleId, entries: data.schedule.entries }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [needsMain, scheduleId, api]);
  const mainEntries = needsMain && mainInfo?.forId === scheduleId ? mainInfo.entries : [];

  // Holidays (always the Philippines): every year the month's week cards and the calendar touch.
  const monthMondays = monthWeeks(month);
  const holidayYears = [...new Set([
    month.getFullYear(),
    monthMondays[0].getFullYear(),
    addDays(monthMondays[monthMondays.length - 1], 6).getFullYear(),
  ])];
  const holidayYearsKey = holidayYears.join(",");
  useEffect(() => {
    if (!openId) return;
    holidayYearsKey.split(",").map(Number).forEach(async (year) => {
      if (holidayRequests.current.has(year)) return;
      holidayRequests.current.add(year);
      try {
        const { data } = await axios.get(`${api}/holidays`, { params: { year }, withCredentials: true });
        if (!data.success) throw new Error(data.message);
        setHolidayCache((c) => ({ ...c, [year]: data.holidays }));
        setHolidayError("");
      } catch {
        // Forget the attempt so browsing to another week retries, and keep the
        // schedule usable in the meantime.
        holidayRequests.current.delete(year);
        setHolidayError("Couldn't load public holidays right now. You can still mark your own days off.");
      }
    });
  }, [openId, holidayYearsKey, api]);

  const publicByDate = {};
  Object.values(holidayCache).forEach((list) => list.forEach((h) => { publicByDate[h.date] = h.name; }));

  // Sends a change, then swaps in the schedule the server sends back. Returns an error
  // message on failure so forms can show it inline.
  const mutate = async (request) => {
    try {
      const { data } = await request();
      if (data.success) {
        mutationVersion.current += 1;
        if (data.schedule) setSchedule(data.schedule);
        return undefined;
      }
      return data.message || "Something went wrong.";
    } catch (err) {
      if (err.response?.status === 403) return err.response.data?.message || "You don't have permission to do that.";
      if (err.response?.status === 413) return "That picture is too large. Try a smaller one.";
      return err.response?.data?.message || "Couldn't save. Check your connection and try again.";
    }
  };

  const saveEntry = async (payload) => {
    const editing = entryModal?.entry;
    const message = await mutate(() => (editing
      ? axios.put(`${api}/${openId}/entries/${editing._id}`, payload, { withCredentials: true })
      : axios.post(`${api}/${openId}/entries`, payload, { withCredentials: true })));
    if (!message) {
      setEntryModal(null);
      toast.success(editing ? "Saved." : "Added to the schedule.");
      if (schedule?.live) toast.info("Everyone on this schedule will be told.");
    }
    return message;
  };

  const applyDayMark = async (state, name) => {
    const message = await mutate(() =>
      axios.put(`${api}/${openId}/holidays`, { date: markDate, state, name }, { withCredentials: true }));
    if (!message) {
      setMarkDate(null);
      toast.success(state === null ? "Back to the default." : state === "workday" ? "Marked as a normal day." : "Marked as a day off.");
    }
    return message;
  };

  const applyDayChanges = async (changes) => {
    const message = await mutate(() => axios.put(`${api}/${openId}/holidays`, { changes }, { withCredentials: true }));
    if (!message) {
      const off = changes.filter((c) => c.state === "holiday").length;
      toast.success(off ? `${dayCountLabel(off)} off saved.` : `${dayCountLabel(changes.length)} updated.`);
    }
    return message;
  };

  const updateSettings = async (patch, success) => {
    const message = await mutate(() => axios.put(`${api}/${openId}`, patch, { withCredentials: true }));
    if (message) toast.error(message);
    else if (success) toast.success(success);
    return message;
  };

  const toggleMyWorkload = async (checked) => {
    const message = await mutate(() => axios.put(`${api}/${openId}/membership`, { countInWorkload: checked }, { withCredentials: true }));
    if (message) toast.error(message);
  };

  const makeMain = () => updateSettings({ isMain: true }, "This is now your main schedule. Your dashboard plans around it.");

  // "Make a copy": a private, editable copy of the whole schedule as one of your own.
  const makeCopy = async () => {
    try {
      const { data } = await axios.post(`${api}/${openId}/duplicate`, {}, { withCredentials: true });
      if (!data.success) return toast.error(data.message);
      toast.success(`"${data.schedule.title}" is yours. Change it however you like.`);
      setSearchParams({ s: data.schedule._id });
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't make a copy.");
    }
  };

  const dismissShared = async (shared) => {
    setDismissing(shared._id);
    try {
      const { data } = await axios.delete(`${api}/${shared._id}/share/${user._id}`, { withCredentials: true });
      if (data.success) {
        setSchedules((list) => list.filter((x) => x._id !== shared._id));
        toast.success("Dismissed. They can share it with you again.");
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't dismiss that.");
    } finally {
      setDismissing(null);
    }
  };

  // ---- Task changes ------------------------------------------------------

  const taskError = (err) => err.response?.data?.message || "Couldn't save the task. Check your connection and try again.";

  // A new task due outside the month on screen moves the view to that month, so it's seen landing.
  const showMonthOf = (iso) => {
    const target = monthOfWeek(fromISODate(iso));
    if (toISODate(target) !== toISODate(month)) setMonth(target);
  };

  const saveTask = async (payload) => {
    const editing = taskModal?.task;
    try {
      const { data } = editing
        ? await axios.put(`${backendUrl}/api/tasks/${editing._id}`, payload, { withCredentials: true })
        : await axios.post(`${backendUrl}/api/tasks`, payload, { withCredentials: true });
      if (!data.success) return data.message || "Couldn't save the task.";
      setTasks((list) => (editing ? list.map((t) => (t._id === editing._id ? data.task : t)) : [...list, data.task]));
      setTaskModal(null);
      if (editing) {
        toast.success("Task saved.");
      } else if (openId) {
        toast.success(tasksHere ? "Task added. It's on the day it's due." : "Task added to your plan.");
        if (tasksHere) showMonthOf(payload.dueDate);
      } else {
        toast.success("Task added. Your dashboard plans time for it.");
      }
      return undefined;
    } catch (err) {
      return taskError(err);
    }
  };

  const toggleTaskDone = async () => {
    const task = taskModal?.task;
    if (!task) return;
    try {
      const { data } = await axios.put(`${backendUrl}/api/tasks/${task._id}`, { isCompleted: !task.isCompleted }, { withCredentials: true });
      if (!data.success) return toast.error(data.message);
      setTasks((list) => list.map((t) => (t._id === task._id ? data.task : t)));
      setTaskModal(null);
      toast.success(data.task.isCompleted ? "Nice work. Marked as done." : "Reopened.");
    } catch (err) {
      toast.error(taskError(err));
    }
  };

  // Dashboard and old /create-task links arrive with ?task=new. With a main schedule, the task
  // form opens on top of it, so the new task is seen on its week.
  const taskParam = searchParams.get("task");
  const mainSchedule = schedules.find((x) => x.role === "owner" && x.isMain);
  const mainId = mainSchedule?._id;
  useEffect(() => {
    if (taskParam !== "new") return;
    if (openId) {
      if (!scheduleId) return;
      setTaskModal({});
      setSearchParams({ s: openId }, { replace: true });
    } else if (!loading) {
      if (mainId) {
        setSearchParams({ s: mainId, task: "new" }, { replace: true });
      } else {
        setTaskModal({});
        setSearchParams({}, { replace: true });
      }
    }
  }, [taskParam, openId, scheduleId, loading, mainId, setSearchParams]);

  // /schedule opens the main schedule. The list of every schedule lives at ?view=all.
  const viewAll = searchParams.get("view") === "all";
  useEffect(() => {
    if (openId || viewAll || taskParam || loading || !mainId) return;
    const next = { s: mainId };
    const wantedTab = searchParams.get("tab");
    if (wantedTab) next.tab = wantedTab;
    setSearchParams(next, { replace: true });
  }, [searchParams, openId, viewAll, taskParam, loading, mainId, setSearchParams]);

  const setTaskDone = async (task, done) => {
    try {
      const { data } = await axios.put(`${backendUrl}/api/tasks/${task._id}`, { isCompleted: done }, { withCredentials: true });
      if (!data.success) {
        toast.error(data.message || "That change didn't save. Try again.");
        return false;
      }
      setTasks((list) => list.map((t) => (t._id === task._id ? data.task : t)));
      showDoneToast(done, async () => { if (await setTaskDone(task, false)) focusTaskCheck(task._id); });
      return true;
    } catch (err) {
      toast.error(taskError(err));
      return false;
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    setConfirming(true);
    try {
      if (confirm.kind === "entry") {
        const message = await mutate(() => axios.delete(`${api}/${openId}/entries/${confirm.entry._id}`, { withCredentials: true }));
        if (message) return toast.error(message);
        setEntryModal(null);
        toast.success("Removed.");
      } else if (confirm.kind === "task") {
        const { data } = await axios.delete(`${backendUrl}/api/tasks/${confirm.task._id}`, { withCredentials: true });
        if (!data.success) return toast.error(data.message);
        setTasks((list) => list.filter((t) => t._id !== confirm.task._id));
        setTaskModal(null);
        toast.success("Task deleted.");
      } else if (confirm.kind === "delete") {
        const { data } = await axios.delete(`${api}/${openId}`, { withCredentials: true });
        if (!data.success) return toast.error(data.message);
        toast.success("Schedule deleted.");
        setSearchParams({ view: "all" });
      } else {
        const { data } = await axios.delete(`${api}/${openId}/share/${user._id}`, { withCredentials: true });
        if (!data.success) return toast.error(data.message);
        toast.success("You left the schedule.");
        setSearchParams({ view: "all" });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong.");
    } finally {
      setConfirming(false);
      setConfirm(null);
    }
  };

  // ---- Create / join / rename --------------------------------------------

  const closeForms = () => {
    setCreateOpen(false);
    setJoinOpen(false);
    setRenameOpen(false);
    setFormError("");
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return setFormError("Give your schedule a name.");
    setSubmitting(true);
    try {
      const { data } = await axios.post(api, { title, theme: newTheme }, { withCredentials: true });
      if (data.success) {
        setNewTitle("");
        closeForms();
        toast.success(data.schedule.isMain ? "Your main schedule is ready. Add your first class." : "Extra schedule created.");
        setSearchParams({ s: data.schedule._id });
      } else {
        setFormError(data.message);
      }
    } catch (err) {
      setFormError(err.response?.data?.message || "Couldn't create the schedule.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRename = async (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return setFormError("Give your schedule a name.");
    setSubmitting(true);
    const message = await mutate(() => axios.put(`${api}/${openId}`, { title }, { withCredentials: true }));
    setSubmitting(false);
    if (message) return setFormError(message);
    closeForms();
    toast.success("Renamed.");
  };

  // A code opens a preview first: open the schedule itself, or copy what you want from it.
  const handleJoin = (e) => {
    e.preventDefault();
    const raw = joinCode.trim();
    // People paste the whole link as often as the code.
    const shareCode = (raw.match(/[?&]code=([A-Za-z0-9]+)/)?.[1] || raw).toUpperCase();
    if (!shareCode) return setFormError("Please enter a share code.");
    setJoinCode("");
    closeForms();
    setImportSource({ shareCode });
  };

  // ---- Render ------------------------------------------------------------

  const extras = schedules.filter((x) => x.role === "owner" && !x.isMain);
  const sharedWithMe = schedules.filter((x) => x.role !== "owner");

  const courses = [
    ...(schedule?.entries || []).filter((e) => e.kind === "class" || e.kind === "exam").map((e) => e.title),
    ...tasks.map((t) => t.course),
  ];

  const markInfo = markDate && schedule && {
    holiday: (() => {
      const o = schedule.holidayOverrides.find((x) => x.date === markDate);
      if (o?.state === "workday") return null;
      if (o?.state === "holiday") return { name: o.name || publicByDate[markDate] || "Day off" };
      return publicByDate[markDate] ? { name: publicByDate[markDate] } : null;
    })(),
    publicName: publicByDate[markDate],
    hasOverride: schedule.holidayOverrides.some((x) => x.date === markDate),
  };

  // Shared by both views. They sit in the schedule's theme scope so every form and dialog
  // takes its colors and shapes.
  const dialogs = (
    <>
      {taskModal && (
        <TaskModal
          task={taskModal.task}
          date={taskModal.date}
          draft={taskModal.draft}
          courses={courses}
          onSave={saveTask}
          onDelete={taskModal.task ? () => setConfirm({ kind: "task", task: taskModal.task }) : undefined}
          onToggleDone={taskModal.task ? toggleTaskDone : undefined}
          onUseCode={(tag) => { setTaskModal(null); setTaskCode(tag); }}
          onClose={() => setTaskModal(null)}
        />
      )}
      {taskCode && (
        <TaskImportDialog
          tag={taskCode}
          onClose={() => setTaskCode(null)}
          onImported={(task) => {
            setTaskCode(null);
            setTasks((list) => [...list, task]);
            if (openId && tasksHere) showMonthOf(taskDueIso(task.dueDate));
          }}
        />
      )}
      {importSource && (
        <ScheduleImportDialog
          source={importSource}
          onClose={() => setImportSource(null)}
          onImported={(added) => { setImportSource(null); setSearchParams({ s: added._id }); }}
        />
      )}
      <ConfirmDialog
        open={Boolean(confirm)}
        tone="danger"
        busy={confirming}
        title={{
          delete: "Delete this schedule?", leave: "Leave this schedule?", entry: "Remove this from the schedule?", task: "Delete this task?",
        }[confirm?.kind] || ""}
        confirmLabel={confirm?.kind === "leave" ? "Leave" : "Delete"}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      >
        {confirm?.kind === "delete" && <p>"{schedule?.title}" will be removed for you and everyone on it{schedule?.live && ", and they'll be told"}. Copies people made stay theirs. This can't be undone.</p>}
        {confirm?.kind === "leave" && <p>You'll lose access to "{schedule?.title}". The owner can share it with you again.{isEditor && " They'll be told you left."}</p>}
        {confirm?.kind === "entry" && <p>"{confirm.entry.title}" will be removed from the schedule{schedule?.live ? " for everyone on it" : ""}.</p>}
        {confirm?.kind === "task" && <p>"{confirm.task.title}" will be deleted, and your plan won't count it anymore.</p>}
      </ConfirmDialog>
      {createOpen && (
        <Modal onClose={closeForms} as="form" className="sched-modal" data-sched-theme={newTheme} onSubmit={handleCreate}>
            <div className="modal-header">
              <h2>{mainSchedule ? "New extra schedule" : "Create your main schedule"}</h2>
              <button type="button" className="modal-close" onClick={closeForms} aria-label="Close">×</button>
            </div>
            <div className="form-grid">
              <div className="form-group full-span">
                <label htmlFor="schedule-title">Name *</label>
                <input
                  id="schedule-title"
                  type="text"
                  value={newTitle}
                  maxLength={80}
                  onChange={(e) => { setNewTitle(e.target.value); setFormError(""); }}
                  placeholder={mainSchedule ? "e.g., Gym, Gaming, Part-time job" : "e.g., 1st Semester"}
                  autoFocus
                />
              </div>
              <div className="form-group full-span">
                <span className="sched-field-label">Theme</span>
                <ThemePicker value={newTheme} onChange={setNewTheme} />
              </div>
            </div>
            <p className="sched-hint">Philippine public holidays are filled in for you. You can add or remove days off later.</p>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="modal-actions sched-modal-actions">
              <button type="button" className="secondary-button" onClick={closeForms}>Cancel</button>
              <button type="submit" className="primary-button" disabled={submitting} aria-busy={submitting}>{submitting && <BusySpinner />}{submitting ? "Creating..." : "Create"}</button>
            </div>
        </Modal>
      )}
    </>
  );

  if (openId) {
    return (
      <AppShell tour={{ page: "schedule", title: "Schedule", steps: SCHEDULE_TOUR, view: "detail" }}>
          {!schedule ? (
            detailFailed ? (
              <div className="panel sched-load-failed">
                <p className="schedule-empty">Couldn't load this schedule.</p>
                <button type="button" className="secondary-button" onClick={() => { setFailedId(null); fetchDetail(); }}>
                  Try again
                </button>
              </div>
            ) : (
              <div className="sched-skeleton" role="status" aria-label="Loading your schedule">
                <span className="skeleton sched-skeleton-title" />
                <span className="skeleton sched-skeleton-chips" />
                <span className="skeleton sched-skeleton-week" />
              </div>
            )
          ) : (
            <div className="sched" data-sched-theme={normalizeTheme(schedule.theme)}>
              <header className="sched-head">
                <div className="sched-head-row">
                  <div className="sched-head-title" data-tour="sched-head">
                    <div className="sched-title-line">
                      <h1>{schedule.title}</h1>
                      <Menu
                        trigger={<ChevronsUpDown size={20} aria-hidden="true" />}
                        label="Switch schedule"
                        className="icon-action sched-switch"
                        align="start"
                        wide
                      >
                        {(close) => (
                          <>
                            {[
                              ...(mainSchedule ? [mainSchedule] : []),
                              ...extras,
                              ...sharedWithMe,
                            ].map((s) => {
                              const current = s._id === schedule._id;
                              return (
                                <MenuItem
                                  key={s._id}
                                  icon={current ? Check : s.role !== "owner" ? Users : s.isMain ? Star : CalendarDays}
                                  hint={s.role !== "owner" ? `Shared by ${s.owner?.name || "a friend"}` : s.isMain ? "Main schedule" : "Extra schedule"}
                                  onClick={() => { close(); if (!current) setSearchParams({ s: s._id }); }}
                                >
                                  {current ? schedule.title : s.title}
                                </MenuItem>
                              );
                            })}
                            <div className="sched-switch-sep" role="separator" />
                            <MenuItem icon={LayoutList} onClick={() => { close(); setSearchParams({ view: "all" }); }}>All schedules</MenuItem>
                            <MenuItem icon={Plus} onClick={() => { close(); setFormError(""); setNewTitle(""); setNewTheme("classic"); setCreateOpen(true); }}>
                              {mainSchedule ? "New extra schedule" : "Create my schedule"}
                            </MenuItem>
                          </>
                        )}
                      </Menu>
                    </div>
                    <AccessChips schedule={schedule} />
                  </div>

                  <div className="sched-actions" data-tour="sched-actions">
                    {canEdit ? (
                      <Menu trigger={<><Plus size={18} aria-hidden="true" /> Add <ChevronDown size={16} aria-hidden="true" /></>} className="primary-button" wide>
                        {(close) => (
                          <>
                            {tasksHere && (
                              <MenuItem icon={ClipboardList} hint="Assignment, project, reading. Only you see it." onClick={() => { close(); setTaskModal({}); }}>Task</MenuItem>
                            )}
                            <MenuItem icon={BookOpen} hint="Repeats on the days you pick" onClick={() => { close(); setEntryModal({ kind: "class" }); }}>Class</MenuItem>
                            <MenuItem icon={PenTool} hint="One day, with study time" onClick={() => { close(); setEntryModal({ kind: "exam" }); }}>Exam</MenuItem>
                            <MenuItem icon={Sparkles} hint="Gym, org, part-time job" onClick={() => { close(); setEntryModal({ kind: "activity" }); }}>Activity</MenuItem>
                            <MenuItem icon={PartyPopper} hint="A one-off thing" onClick={() => { close(); setEntryModal({ kind: "event" }); }}>Event</MenuItem>
                          </>
                        )}
                      </Menu>
                    ) : tasksHere && (
                      <button type="button" className="primary-button" onClick={() => setTaskModal({})}>
                        <Plus size={18} aria-hidden="true" /> Add task
                      </button>
                    )}
                    {schedule.canShare && (
                      <button type="button" className="secondary-button sched-share" onClick={() => setShareOpen(true)} aria-label="Share">
                        <Share2 size={18} aria-hidden="true" /> <span className="sched-share-label">Share</span>
                      </button>
                    )}
                    {!isOwner && (
                      <button type="button" className="secondary-button sched-add-mine" onClick={() => setImportSource({ scheduleId: schedule._id })}>
                        <Download size={18} aria-hidden="true" /> Add to mine
                      </button>
                    )}
                    <Menu trigger={<MoreHorizontal size={20} aria-hidden="true" />} label="More options" className="icon-action sched-more">
                      {(close) => (
                        <>
                          {isOwner && (
                            <MenuItem icon={Palette} hint="Classic, Sage or Lavender" onClick={() => { close(); setThemeOpen(true); }}>Theme</MenuItem>
                          )}
                          <MenuItem icon={Copy} hint="A private copy that's all yours" onClick={() => { close(); makeCopy(); }}>Make a copy</MenuItem>
                          {isOwner && (
                            <MenuItem icon={Pencil} onClick={() => { close(); setNewTitle(schedule.title); setFormError(""); setRenameOpen(true); }}>Rename</MenuItem>
                          )}
                          {isOwner && !schedule.isMain && (
                            <MenuItem icon={Star} hint="Your dashboard plans around it" onClick={() => { close(); makeMain(); }}>Make this my main</MenuItem>
                          )}
                          {isOwner ? (
                            <MenuItem icon={Trash2} tone="danger" onClick={() => { close(); setConfirm({ kind: "delete" }); }}>Delete schedule</MenuItem>
                          ) : (
                            <MenuItem icon={LogOut} tone="danger" onClick={() => { close(); setConfirm({ kind: "leave" }); }}>Leave schedule</MenuItem>
                          )}
                        </>
                      )}
                    </Menu>
                  </div>
                </div>

                {(isEditor || role === "viewer" || (isOwner && (schedule.live || !schedule.isMain)) || !isOwner) && (
                <div className="sched-head-notes">
                {(() => {
                  const notes = [];
                  if (isEditor) notes.push({ short: `You and ${schedule.owner?.name || "the owner"} both edit this. Changes show for everyone within seconds.`, full: `You and ${schedule.owner?.name || "the owner"} both edit this. Changes show up for everyone on it within a few seconds, and they're told what changed.` });
                  if (role === "viewer") notes.push({ short: "View only. Changes show up as they happen.", full: `You see changes as they happen, but can't make them. "Make a copy" or "Add to mine" gives you one you can edit.` });
                  if (isOwner && schedule.live) notes.push({ short: "Others can edit this schedule. Their changes show up here within seconds.", full: "Others can edit this schedule. Their changes show up here within a few seconds, and the latest are listed under the week." });
                  if (isOwner && !schedule.isMain) notes.push({ short: "An extra schedule sits on top of your main one. Overlaps are flagged.", full: "An extra schedule sits on top of your main one. Anything that overlaps a class or exam in your main schedule is flagged." });
                  const workloadNote = !isOwner
                    ? "Use this if it's a class you actually attend. Its time is taken off your study time, your tasks show on it, and it follows any changes made to it."
                    : !schedule.isMain
                      ? "Time in this schedule is taken off your study time, next to your main one. Turn it off if it shouldn't affect your plan."
                      : null;
                  const hasMore = notes.length > 1 || workloadNote;
                  return (
                    <>
                      {notes[0] && <p className="sched-hint">{notes[0].short}</p>}
                      {hasMore && (
                        <details className="sched-about">
                          <summary>About this schedule <ChevronDown size={16} aria-hidden="true" /></summary>
                          {notes.slice(1).map((n) => <p key={n.short} className="sched-hint">{n.full}</p>)}
                          {workloadNote && <p className="sched-hint">{workloadNote}</p>}
                        </details>
                      )}
                    </>
                  );
                })()}

                {!isOwner && (
                  <label className="sched-check sched-workload-toggle">
                    <input type="checkbox" checked={Boolean(schedule.myCountInWorkload)} onChange={(e) => toggleMyWorkload(e.target.checked)} />
                    <span>Count this in my dashboard workload</span>
                  </label>
                )}
                {isOwner && !schedule.isMain && (
                  <label className="sched-check sched-workload-toggle">
                    <input
                      type="checkbox"
                      checked={schedule.countInWorkload !== false}
                      onChange={(e) => updateSettings({ countInWorkload: e.target.checked })}
                    />
                    <span>Count this in my dashboard workload</span>
                  </label>
                )}
                </div>
                )}
              </header>

              <Tabs
                tabs={[
                  { id: "week", label: "Week" },
                  ...(tasksHere ? [{ id: "tasks", label: "Tasks", count: openTasks.length }] : []),
                  { id: "days-off", label: "Days off" },
                ]}
                value={tab}
                onChange={setTab}
                label="Schedule sections"
              />

              {tab === "week" && (
                <div role="tabpanel" id="panel-week" aria-labelledby="tab-week">
                <MonthView
                  month={month}
                  onMonthChange={setMonth}
                  entries={schedule.entries}
                  overrides={schedule.holidayOverrides}
                  publicByDate={publicByDate}
                  canEdit={canEdit}
                  onAddEntry={(date) => setEntryModal({ kind: "class", date })}
                  onOpenEntry={(entry) => (canEdit ? setEntryModal({ entry, kind: entry.kind }) : setDetailsEntry(entry))}
                  onMarkDay={setMarkDate}
                  mainEntries={mainEntries}
                  tasks={tasksHere ? openTasks : []}
                  onOpenTask={(task) => setTaskModal({ task: tasks.find((t) => t._id === task._id) || task })}
                />
                {tasksHere && (schedule.live || (schedule.access?.people ?? 0) > 0) && (
                  <p className="sched-hint sched-week-note">Your tasks show under the day they're due. Only you see them, not the others on this schedule.</p>
                )}

                {schedule.live && <ScheduleActivity schedule={schedule} />}

                </div>
              )}

              {tab === "tasks" && tasksHere && (
                <TasksTab
                  tasks={tasks}
                  week={week}
                  now={now}
                  onAdded={(task) => setTasks((list) => [...list, task])}
                  onMoreDetails={(draft) => setTaskModal({ draft })}
                  onUseCode={(tag) => setTaskCode(tag)}
                  onEdit={(task) => setTaskModal({ task })}
                  onSetDone={setTaskDone}
                  onDelete={(task) => setConfirm({ kind: "task", task })}
                />
              )}

              {tab === "days-off" && (
                <div role="tabpanel" id="panel-days-off" aria-labelledby="tab-days-off">
                <HolidayCalendar
                  month={month}
                  onMonthChange={setMonth}
                  publicByDate={publicByDate}
                  overrides={schedule.holidayOverrides}
                  holidayError={holidayError}
                  canEdit={canEdit}
                  onApply={applyDayChanges}
                />
                </div>
              )}
            </div>
          )}
        <ShellOverlays>
        <div className="sched-layer" data-sched-theme={normalizeTheme(schedule?.theme)}>
          {themeOpen && schedule && (
            <Modal onClose={() => setThemeOpen(false)} className="sched-modal sched-modal-narrow sched-theme-dialog" labelledBy="sched-theme-title">
                <div className="modal-header">
                  <h2 id="sched-theme-title">Theme</h2>
                  <button type="button" className="modal-close" onClick={() => setThemeOpen(false)} aria-label="Close">×</button>
                </div>
                <p className="sched-hint">Changes the colours of this schedule for everyone who opens it.</p>
                <ThemePicker
                  value={schedule.theme}
                  onChange={(theme) => { if (theme !== schedule.theme) updateSettings({ theme }); }}
                />
                <div className="modal-actions sched-modal-actions">
                  <button type="button" className="primary-button" onClick={() => setThemeOpen(false)}>Done</button>
                </div>
            </Modal>
          )}
          {entryModal && (
            <EntryModal
              entry={entryModal.entry}
              kind={entryModal.kind}
              date={entryModal.date}
              onSave={saveEntry}
              onDelete={entryModal.entry ? () => setConfirm({ kind: "entry", entry: entryModal.entry }) : undefined}
              onClose={() => setEntryModal(null)}
            />
          )}
          {detailsEntry && <EntryDetails entry={detailsEntry} onClose={() => setDetailsEntry(null)} />}
          {markDate && schedule && (
            <DayMarkModal
              date={markDate}
              holiday={markInfo.holiday}
              publicName={markInfo.publicName}
              hasOverride={markInfo.hasOverride}
              onApply={applyDayMark}
              onClose={() => setMarkDate(null)}
            />
          )}
          {shareOpen && schedule && (
            <ShareModal
              schedule={schedule}
              backendUrl={backendUrl}
              currentUserId={user?._id}
              onUpdated={(next) => { mutationVersion.current += 1; setSchedule(next); }}
              onClose={() => setShareOpen(false)}
            />
          )}
          {renameOpen && (
            <Modal onClose={closeForms} as="form" className="sched-modal sched-modal-narrow" onSubmit={handleRename}>
                <div className="modal-header">
                  <h2>Rename schedule</h2>
                  <button type="button" className="modal-close" onClick={closeForms} aria-label="Close">×</button>
                </div>
                <div className="form-group">
                  <label htmlFor="rename-title">Name</label>
                  <input id="rename-title" type="text" value={newTitle} maxLength={80} onChange={(e) => { setNewTitle(e.target.value); setFormError(""); }} autoFocus />
                </div>
                {formError && <p className="form-error" role="alert">{formError}</p>}
                <div className="modal-actions sched-modal-actions">
                  <button type="button" className="secondary-button" onClick={closeForms}>Cancel</button>
                  <button type="submit" className="primary-button" disabled={submitting} aria-busy={submitting}>{submitting && <BusySpinner />}{submitting ? "Saving..." : "Save"}</button>
                </div>
            </Modal>
          )}
          {dialogs}
        </div>
        </ShellOverlays>
      </AppShell>
    );
  }

  return (
    <AppShell tour={{ page: "schedule", title: "Schedule", steps: SCHEDULE_TOUR, view: "list" }}>
        <div data-tour="sched-intro">
          <PageHeader
            title="All schedules"
            description="Your main schedule is what Today plans around. Extra schedules hold anything else, like a gym routine or a part-time job."
          />
        </div>

        <div className="sched-list-actions" data-tour="sched-list-actions">
          <button className="primary-button" onClick={() => { setFormError(""); setNewTitle(""); setNewTheme("classic"); setCreateOpen(true); }}>
            <Plus size={18} aria-hidden="true" /> {mainSchedule ? "New extra schedule" : "Create my schedule"}
          </button>
          <button className="secondary-button" onClick={() => setTaskModal({})}>
            <ClipboardList size={18} aria-hidden="true" /> Add a task
          </button>
          <button className="secondary-button" onClick={() => { setFormError(""); setJoinOpen(true); }}>
            <Link2 size={18} aria-hidden="true" /> Open with a code
          </button>
        </div>

        {loading ? (
          <div className="sched-skeleton" role="status" aria-label="Loading your schedules">
            <span className="skeleton sched-skeleton-row" />
            <span className="skeleton sched-skeleton-row" />
          </div>
        ) : loadFailed ? (
          <div className="panel sched-load-failed">
            <p className="schedule-empty">Couldn't load your schedules.</p>
            <button type="button" className="secondary-button" onClick={() => { setLoading(true); fetchList(); }}>Try again</button>
          </div>
        ) : (
          <div className="sched-list">
            <section className="sched-section" data-tour="sched-main" aria-labelledby="sched-main-heading">
              <h2 className="sched-section-title" id="sched-main-heading">Main schedule</h2>
              {mainSchedule ? (
                <ul className="sched-rows panel">
                  <ScheduleRow
                    schedule={mainSchedule}
                    chip="Main"
                    meta={`${entryCountLabel(mainSchedule.entryCount)} · ${sharingLabel(mainSchedule)}. Today plans around this one.`}
                    onOpen={() => setSearchParams({ s: mainSchedule._id })}
                  />
                </ul>
              ) : (
                <div className="panel">
                  <EmptyState compact icon={CalendarDays} title="No main schedule yet">
                    Create it with your classes and exams, or open a classmate's with a code. Today plans around this one.
                  </EmptyState>
                </div>
              )}
            </section>

            {extras.length > 0 && (
              <section className="sched-section" data-tour="sched-extras" aria-labelledby="sched-extras-heading">
                <h2 className="sched-section-title" id="sched-extras-heading">Extra schedules</h2>
                <ul className="sched-rows panel">
                  {extras.map((s) => (
                    <ScheduleRow
                      key={s._id}
                      schedule={s}
                      chip={s.countInWorkload ? "Counts" : "Not counted"}
                      meta={`${entryCountLabel(s.entryCount)} · ${sharingLabel(s)}${s.live ? ", editable by others" : ""}`}
                      onOpen={() => setSearchParams({ s: s._id })}
                    />
                  ))}
                </ul>
              </section>
            )}

            {sharedWithMe.length > 0 && (
              <section className="sched-section" data-tour="sched-shared" aria-labelledby="sched-shared-heading">
                <h2 className="sched-section-title" id="sched-shared-heading">Shared with you</h2>
                <p className="sched-hint">Open one to see it as it changes. Some you can edit together. Copying one into your own is your call.</p>
                <ul className="sched-rows panel">
                  {sharedWithMe.map((s) => (
                    <ScheduleRow
                      key={s._id}
                      schedule={s}
                      chip={s.role === "editor" ? "Editor" : "Viewer"}
                      meta={`${entryCountLabel(s.entryCount)} · by ${s.owner?.name || "a friend"}`}
                      onOpen={() => setSearchParams({ s: s._id })}
                    >
                      <Menu trigger={<MoreHorizontal size={20} aria-hidden="true" />} label={`More for ${s.title}`} className="icon-action">
                        {(close) => (
                          <>
                            <MenuItem icon={Download} hint="Copy the parts you want" onClick={() => { close(); setImportSource({ scheduleId: s._id }); }}>Add to mine</MenuItem>
                            <MenuItem icon={X} hint="They can share it again" disabled={dismissing === s._id} onClick={() => { close(); dismissShared(s); }}>Dismiss</MenuItem>
                          </>
                        )}
                      </Menu>
                    </ScheduleRow>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      <ShellOverlays>
      <div className="sched-layer" data-sched-theme={normalizeTheme(mainSchedule?.theme)}>
        {dialogs}

        {joinOpen && (
          <Modal onClose={closeForms} as="form" className="sched-modal sched-modal-narrow" onSubmit={handleJoin}>
              <div className="modal-header">
                <h2>Open with a code</h2>
                <button type="button" className="modal-close" onClick={closeForms} aria-label="Close">×</button>
              </div>
              <div className="form-group">
                <label htmlFor="schedule-code">Share code or link</label>
                <p className="sched-hint">Ask a classmate for their code or link. You'll see what's in it, then open it or copy the parts you want.</p>
                <input
                  id="schedule-code"
                  type="text"
                  value={joinCode}
                  maxLength={200}
                  onChange={(e) => { setJoinCode(e.target.value); setFormError(""); }}
                  placeholder="e.g., K7PQ2M"
                  autoFocus
                  autoComplete="off"
                />
              </div>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="modal-actions sched-modal-actions">
                <button type="button" className="secondary-button" onClick={closeForms}>Cancel</button>
                <button type="submit" className="primary-button" disabled={submitting} aria-busy={submitting}>{submitting && <BusySpinner />}Continue</button>
              </div>
          </Modal>
        )}
      </div>
      </ShellOverlays>
    </AppShell>
  );
}
