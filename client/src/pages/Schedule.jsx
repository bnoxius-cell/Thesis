import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Plus, Link2, ArrowLeft, Share2, Trash2, LogOut, CalendarDays, Star, Download, X, ChevronDown, MoreHorizontal,
  Copy, Palette, Pencil, Lock, Users, Globe2, ClipboardList, BookOpen, PenTool, Sparkles, PartyPopper, Eye,
} from "lucide-react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import ConfirmDialog from "../components/ConfirmDialog";
import PageTour from "../components/PageTour";
import TaskImportDialog from "../components/TaskImportDialog";
import WeekView from "../components/schedule/WeekView";
import HolidayCalendar from "../components/schedule/HolidayCalendar";
import TasksTab from "../components/schedule/TasksTab";
import Tabs from "../components/Tabs";
import EntryModal from "../components/schedule/EntryModal";
import EntryDetails from "../components/schedule/EntryDetails";
import TaskModal from "../components/schedule/TaskModal";
import DayMarkModal from "../components/schedule/DayMarkModal";
import ShareModal from "../components/schedule/ShareModal";
import ScheduleImportDialog from "../components/schedule/ScheduleImportDialog";
import ScheduleActivity from "../components/schedule/ScheduleActivity";
import Menu, { MenuItem } from "../components/schedule/Menu";
import { useAuth } from "./authentication/AuthContext";
import useWorkload from "../utils/useWorkload";
import { useTabParam } from "../utils/useTabParam";
import {
  SCHEDULE_THEMES, startOfWeek, addDays, toISODate, fromISODate, taskDueIso,
} from "../utils/scheduleUtils";
import { SCHEDULE_TOUR } from "../utils/tours";
import "../App.css";
import Modal from "../components/Modal";

// How often an open schedule checks for changes made by others. The check is tiny; the full
// schedule is only downloaded again when it says something changed.
const LIVE_CHECK_MS = 4000;

function ThemePicker({ value, disabled, onChange }) {
  return (
    <div className="sched-theme-picker" role="radiogroup" aria-label="Schedule theme">
      {SCHEDULE_THEMES.map((t) => (
        <button
          key={t.key}
          type="button"
          role="radio"
          aria-checked={value === t.key}
          className={value === t.key ? "active" : ""}
          disabled={disabled}
          onClick={() => onChange(t.key)}
        >
          <span className="sched-theme-dots" aria-hidden="true">
            {t.swatch.map((c) => <i key={c} style={{ background: c }} />)}
          </span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// One line under the title saying how open the schedule is, like the lock or globe in Google Docs.
function AccessLine({ schedule }) {
  const { people = 0, link = "restricted" } = schedule.access || {};
  if (schedule.role !== "owner") {
    return (
      <p className="sched-access">
        {schedule.role === "editor" ? <Pencil size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
        {schedule.role === "editor" ? "You can edit this" : "View only"}
        {people > 0 && ` · ${people + 1} people on it`}
      </p>
    );
  }
  if (people === 0 && link === "restricted") {
    return <p className="sched-access"><Lock size={15} aria-hidden="true" /> Private, only you can see it</p>;
  }
  return (
    <p className="sched-access">
      {link === "restricted" ? <Users size={15} aria-hidden="true" /> : <Globe2 size={15} aria-hidden="true" />}
      {people > 0 ? `Shared with ${people} ${people === 1 ? "person" : "people"}` : "Not shared with anyone yet"}
      {link !== "restricted" && ` · anyone with the code can ${link === "editor" ? "edit" : "view"}`}
    </p>
  );
}

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
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [calMonth, setCalMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
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

  useEffect(() => {
    if (!openId) fetchList();
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

  // Holidays (always the Philippines): every year the visible week and calendar month touch.
  const holidayYears = [...new Set([weekStart.getFullYear(), addDays(weekStart, 6).getFullYear(), calMonth.getFullYear()])];
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

  // A new task due outside the week on screen moves the view to that week, so it's seen landing.
  const showWeekOf = (iso) => {
    const target = startOfWeek(fromISODate(iso));
    if (toISODate(target) !== toISODate(weekStart)) setWeekStart(target);
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
        if (tasksHere) showWeekOf(payload.dueDate);
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

  const DONE_TOASTS = ["Done. One less thing.", "Nice, that's off your plate.", "Finished. Take a breath before the next one."];
  const setTaskDone = async (task, done) => {
    try {
      const { data } = await axios.put(`${backendUrl}/api/tasks/${task._id}`, { isCompleted: done }, { withCredentials: true });
      if (!data.success) return toast.error(data.message || "That change didn't save. Try again.");
      setTasks((list) => list.map((t) => (t._id === task._id ? data.task : t)));
      toast.success(done ? DONE_TOASTS[Math.floor(Math.random() * DONE_TOASTS.length)] : "Reopened.");
    } catch (err) {
      toast.error(taskError(err));
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
            if (openId && tasksHere) showWeekOf(taskDueIso(task.dueDate));
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
    </>
  );

  if (openId) {
    return (
      <div className="app app-layout">
        <Header />
        <main className="dashboard">
          <button type="button" className="sched-back" onClick={() => setSearchParams({ view: "all" })}>
            <ArrowLeft size={16} aria-hidden="true" /> All schedules
          </button>

          {!schedule ? (
            <div className="panel" style={{ textAlign: "center" }}>
              <p className="schedule-empty">{detailFailed ? "Couldn't load this schedule." : "Loading your schedule..."}</p>
              {detailFailed && (
                <button type="button" className="secondary-button" onClick={() => { setFailedId(null); fetchDetail(); }}>
                  Try again
                </button>
              )}
            </div>
          ) : (
            <div className="sched" data-sched-theme={schedule.theme}>
              <section className="sched-top panel" data-tour="sched-head">
                <div className="sched-top-row">
                  <div className="sched-top-title">
                    <span className="panel-kicker">
                      <CalendarDays size={16} aria-hidden="true" />
                      {isOwner ? (schedule.isMain ? "Your main schedule" : "Extra schedule") : `Shared by ${schedule.owner?.name || "a friend"}`}
                    </span>
                    <h1>{schedule.title}</h1>
                    <AccessLine schedule={schedule} />
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
                      <button type="button" className="secondary-button" onClick={() => setShareOpen(true)}>
                        <Share2 size={18} aria-hidden="true" /> Share
                      </button>
                    )}
                    {!isOwner && (
                      <button type="button" className="secondary-button" onClick={() => setImportSource({ scheduleId: schedule._id })}>
                        <Download size={18} aria-hidden="true" /> Add to mine
                      </button>
                    )}
                    {isOwner && (
                      <Menu trigger={<><Palette size={18} aria-hidden="true" /> Theme</>} className="secondary-button" wide>
                        {(close) => (
                          <div className="sched-menu-themes">
                            <ThemePicker value={schedule.theme} onChange={(theme) => { close(); updateSettings({ theme }); }} />
                          </div>
                        )}
                      </Menu>
                    )}
                    <Menu trigger={<MoreHorizontal size={18} aria-hidden="true" />} label="More options" className="sched-icon-button sched-more">
                      {(close) => (
                        <>
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

                {isEditor && (
                  <p className="sched-hint">You and {schedule.owner?.name || "the owner"} both edit this. Changes show up for everyone on it within a few seconds, and they're told what changed.</p>
                )}
                {role === "viewer" && (
                  <p className="sched-hint">You see changes as they happen, but can't make them. "Make a copy" or "Add to mine" gives you one you can edit.</p>
                )}
                {isOwner && schedule.live && (
                  <p className="sched-hint">Others can edit this schedule. Their changes show up here within a few seconds, and the latest are listed under the week.</p>
                )}
                {isOwner && !schedule.isMain && (
                  <p className="sched-hint">An extra schedule sits on top of your main one. Anything that overlaps a class or exam in your main schedule is flagged.</p>
                )}

                {!isOwner && (
                  <label className="sched-check sched-workload-toggle">
                    <input type="checkbox" checked={Boolean(schedule.myCountInWorkload)} onChange={(e) => toggleMyWorkload(e.target.checked)} />
                    <span>
                      Count this in my dashboard workload
                      <small>Use this if it's a class you actually attend. Its time is taken off your study time, your tasks show on it, and it follows any changes made to it.</small>
                    </span>
                  </label>
                )}
                {isOwner && !schedule.isMain && (
                  <label className="sched-check sched-workload-toggle">
                    <input
                      type="checkbox"
                      checked={schedule.countInWorkload !== false}
                      onChange={(e) => updateSettings({ countInWorkload: e.target.checked })}
                    />
                    <span>
                      Count this in my dashboard workload
                      <small>Time in this schedule is taken off your study time, next to your main one. Turn it off if it shouldn't affect your plan.</small>
                    </span>
                  </label>
                )}
              </section>

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
                <WeekView
                  weekStart={weekStart}
                  entries={schedule.entries}
                  overrides={schedule.holidayOverrides}
                  publicByDate={publicByDate}
                  canEdit={canEdit}
                  onShiftWeek={(n) => setWeekStart((w) => addDays(w, n * 7))}
                  onToday={() => setWeekStart(startOfWeek(new Date()))}
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
                  onAdd={() => setTaskModal({})}
                  onUseCode={(tag) => setTaskCode(tag)}
                  onEdit={(task) => setTaskModal({ task })}
                  onSetDone={setTaskDone}
                  onDelete={(task) => setConfirm({ kind: "task", task })}
                />
              )}

              {tab === "days-off" && (
                <div role="tabpanel" id="panel-days-off" aria-labelledby="tab-days-off">
                <HolidayCalendar
                  month={calMonth}
                  onMonthChange={setCalMonth}
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
        </main>
        <Footer />
        <PageTour page="schedule" title="Schedule" steps={SCHEDULE_TOUR} />

        <div className="sched-layer" data-sched-theme={schedule?.theme || "classic"}>
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
                  <button type="submit" className="primary-button" disabled={submitting}>{submitting ? "Saving..." : "Save"}</button>
                </div>
            </Modal>
          )}
          {dialogs}
        </div>
      </div>
    );
  }

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        <section className="hero" id="schedule-hero" data-tour="sched-intro">
          <div className="hero-copy">
            <span className="eyebrow">Plan your week</span>
            <h1>Your schedule</h1>
            <p>
              Your classes, exams and tasks in one week. Your main schedule is what the dashboard plans around.
              Extra schedules hold anything else, and shared ones work like a Google Doc: whoever can edit changes it for everyone.
            </p>
          </div>
          <aside className="hero-panel">
            <h2>What you can do</h2>
            <ul className="hero-list">
              <li>Add classes, exams, tasks and events</li>
              <li>Put Google Meet or Zoom links on online classes</li>
              <li>Mark days off on a Philippine holiday calendar</li>
              <li>Share with viewers or editors, or keep it private</li>
              <li>Make a copy of any schedule you can see</li>
              <li>Pick a theme that suits light or dark mode</li>
            </ul>
          </aside>
        </section>

        <div className="groups-actions" data-tour="sched-list-actions">
          <button className="primary-button" onClick={() => { setFormError(""); setNewTitle(""); setCreateOpen(true); }}>
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
          <div className="panel" style={{ textAlign: "center" }}>
            <p className="schedule-empty">Loading your schedules...</p>
          </div>
        ) : loadFailed ? (
          <div className="panel" style={{ textAlign: "center" }}>
            <p className="schedule-empty">Couldn't load your schedules.</p>
            <button type="button" className="secondary-button" onClick={() => { setLoading(true); fetchList(); }}>Try again</button>
          </div>
        ) : (
          <>
            <section className="sched-section" data-tour="sched-main">
              <h2 className="sched-section-title">Main schedule</h2>
              {mainSchedule ? (
                <button
                  type="button"
                  className="group-card sched-card sched-main-card"
                  data-sched-theme={mainSchedule.theme}
                  onClick={() => setSearchParams({ s: mainSchedule._id })}
                >
                  <span className="sched-card-band" aria-hidden="true" />
                  <div className="group-header">
                    <h3>{mainSchedule.title}</h3>
                    <span className="owner-badge">Main</span>
                  </div>
                  <p className="group-desc">
                    {mainSchedule.entryCount} {mainSchedule.entryCount === 1 ? "entry" : "entries"}
                    {mainSchedule.private ? " · private" : mainSchedule.collaboratorCount > 0 ? ` · shared with ${mainSchedule.collaboratorCount}` : " · shared by code"}
                    {" · "}Your dashboard and workload are based on this one.
                  </p>
                </button>
              ) : (
                <div className="panel" style={{ textAlign: "center" }}>
                  <p className="schedule-empty">
                    You don't have a main schedule yet. Create it with your classes and exams, or open a classmate's with a code.
                    Your dashboard plans around this one.
                  </p>
                </div>
              )}
            </section>

            {extras.length > 0 && (
              <section className="sched-section" data-tour="sched-extras">
                <h2 className="sched-section-title">Extra schedules</h2>
                <div className="groups-grid">
                  {extras.map((s) => (
                    <button
                      key={s._id}
                      type="button"
                      className="group-card sched-card"
                      data-sched-theme={s.theme}
                      onClick={() => setSearchParams({ s: s._id })}
                    >
                      <span className="sched-card-band" aria-hidden="true" />
                      <div className="group-header">
                        <h3>{s.title}</h3>
                        <span className="owner-badge">{s.countInWorkload ? "Counts" : "Not counted"}</span>
                      </div>
                      <p className="group-desc">
                        {s.entryCount} {s.entryCount === 1 ? "entry" : "entries"}
                        {s.private ? " · private" : s.collaboratorCount > 0 ? ` · shared with ${s.collaboratorCount}` : " · shared by code"}
                        {s.live && " · editable by others"}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {sharedWithMe.length > 0 && (
              <section className="sched-section" data-tour="sched-shared">
                <h2 className="sched-section-title">Shared with you</h2>
                <p className="sched-hint">Open one to see it as it changes. Some you can edit together. Copying one into your own is your call.</p>
                <div className="groups-grid">
                  {sharedWithMe.map((s) => (
                    <div key={s._id} className="group-card sched-card sched-shared-card" data-sched-theme={s.theme}>
                      <span className="sched-card-band" aria-hidden="true" />
                      <div className="group-header">
                        <h3>{s.title}</h3>
                        <span className="owner-badge">{s.role === "editor" ? "Editor" : "Viewer"}</span>
                      </div>
                      <p className="group-desc">
                        {s.entryCount} {s.entryCount === 1 ? "entry" : "entries"} · by {s.owner?.name}
                      </p>
                      <div className="sched-shared-actions">
                        <button type="button" className="primary-button small" onClick={() => setSearchParams({ s: s._id })}>Open</button>
                        <button type="button" className="secondary-button small" onClick={() => setImportSource({ scheduleId: s._id })}>
                          <Download size={15} aria-hidden="true" /> Add to mine
                        </button>
                        <button type="button" className="ghost-button small" onClick={() => dismissShared(s)} disabled={dismissing === s._id}>
                          <X size={15} aria-hidden="true" /> Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <Footer />
      <PageTour page="schedule" title="Schedule" steps={SCHEDULE_TOUR} />

      <div className="sched-layer" data-sched-theme={mainSchedule?.theme || "classic"}>
        {dialogs}

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
                  <span className="sched-field-label">Look</span>
                  <ThemePicker value={newTheme} onChange={setNewTheme} />
                </div>
              </div>
              <p className="sched-hint">Philippine public holidays are filled in for you. You can add or remove days off later.</p>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="modal-actions sched-modal-actions">
                <button type="button" className="secondary-button" onClick={closeForms}>Cancel</button>
                <button type="submit" className="primary-button" disabled={submitting}>{submitting ? "Creating..." : "Create"}</button>
              </div>
          </Modal>
        )}

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
                <button type="submit" className="primary-button" disabled={submitting}>Continue</button>
              </div>
          </Modal>
        )}
      </div>
    </div>
  );
}
