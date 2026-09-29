import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { Plus, Link2, ArrowLeft, Share2, Copy, Trash2, LogOut, CalendarDays } from "lucide-react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import ConfirmDialog from "../components/ConfirmDialog";
import WeekView from "../components/schedule/WeekView";
import HolidayPanel from "../components/schedule/HolidayPanel";
import EntryModal from "../components/schedule/EntryModal";
import DayMarkModal from "../components/schedule/DayMarkModal";
import ShareModal from "../components/schedule/ShareModal";
import { useAuth } from "./authentication/AuthContext";
import {
  SCHEDULE_THEMES, COUNTRY_CODES, countryName, startOfWeek, addDays,
} from "../utils/scheduleUtils";
import "../App.css";

const SCHEDULE_REFRESH_MS = 15000;

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

export default function Schedule() {
  const { backendUrl, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get("s");

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTheme, setNewTheme] = useState("classic");
  const [newCountry, setNewCountry] = useState("PH");
  const [joinCode, setJoinCode] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Both are tied to the id they belong to, so switching schedules never shows the
  // previous one (or its error) while the next loads.
  const [loadedSchedule, setSchedule] = useState(null);
  const [failedId, setFailedId] = useState(null);
  const schedule = loadedSchedule?._id === openId ? loadedSchedule : null;
  const detailFailed = failedId === openId;
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [holidayCache, setHolidayCache] = useState({}); // "PH-2026" -> [{date, name}]
  const [holidayError, setHolidayError] = useState("");

  const [entryModal, setEntryModal] = useState(null); // { entry?, kind, date? }
  const [markDate, setMarkDate] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // { kind: "delete" | "leave" | "entry", entry? }
  const [confirming, setConfirming] = useState(false);

  // Bumped after every save, so a slow background refresh that started earlier can't
  // land afterwards and overwrite what the user just changed.
  const mutationVersion = useRef(0);
  // Holiday requests already sent, so a re-render (or Strict Mode's double effect run)
  // never asks for the same country and year twice.
  const holidayRequests = useRef(new Set());

  const api = `${backendUrl}/api/schedules`;
  const role = schedule?.role;
  const canEdit = role === "owner" || role === "editor";
  const isOwner = role === "owner";

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
        toast.error("That schedule isn't available. It may have been deleted or unshared.");
        setSearchParams({});
      } else if (!quiet) {
        setFailedId(openId);
      }
    }
  }, [api, openId, setSearchParams]);

  useEffect(() => {
    if (!openId) return undefined;
    fetchDetail();
    // Pick up edits from anyone else working on the same schedule.
    const id = setInterval(() => { if (!document.hidden) fetchDetail({ quiet: true }); }, SCHEDULE_REFRESH_MS);
    return () => clearInterval(id);
  }, [openId, fetchDetail]);

  // Holidays: fetch every year the visible week touches, once per country and year.
  const country = schedule?.country;
  const weekYears = [weekStart.getFullYear(), addDays(weekStart, 6).getFullYear()];
  const panelYear = addDays(weekStart, 3).getFullYear();
  useEffect(() => {
    if (!country) return;
    const years = [...new Set([...weekYears, panelYear])];
    years.forEach(async (year) => {
      const key = `${country}-${year}`;
      if (holidayRequests.current.has(key)) return;
      holidayRequests.current.add(key);
      try {
        const { data } = await axios.get(`${api}/holidays`, { params: { year, country }, withCredentials: true });
        if (!data.success) throw new Error(data.message);
        setHolidayCache((c) => ({ ...c, [key]: data.holidays }));
        setHolidayError("");
      } catch {
        // Forget the attempt so browsing to another week retries, and keep the
        // schedule usable in the meantime.
        holidayRequests.current.delete(key);
        setHolidayError("Couldn't load public holidays right now. You can still mark your own days off.");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, weekStart, api]);

  const publicHolidays = country ? (holidayCache[`${country}-${panelYear}`] || []) : [];
  const publicByDate = {};
  if (country) {
    Object.entries(holidayCache).forEach(([key, list]) => {
      if (key.startsWith(`${country}-`)) list.forEach((h) => { publicByDate[h.date] = h.name; });
    });
  }

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
      toast.success(editing ? "Entry updated." : "Added to your schedule.");
    }
    return message;
  };

  const applyDayMark = async (state, name) => {
    const message = await mutate(() =>
      axios.put(`${api}/${openId}/holidays`, { date: markDate, state, name }, { withCredentials: true }));
    if (!message) {
      setMarkDate(null);
      toast.success(state === null ? "Back to the default." : state === "workday" ? "Marked as a regular day." : "Marked as a holiday.");
    }
    return message;
  };

  const updateSettings = async (patch) => {
    const message = await mutate(() => axios.put(`${api}/${openId}`, patch, { withCredentials: true }));
    if (message) toast.error(message);
  };

  const duplicate = async () => {
    try {
      const { data } = await axios.post(`${api}/${openId}/duplicate`, {}, { withCredentials: true });
      if (data.success) {
        toast.success("Copied. This one is all yours to edit.");
        setSearchParams({ s: data.schedule._id });
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't make a copy.");
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    setConfirming(true);
    try {
      let request;
      if (confirm.kind === "entry") {
        request = () => axios.delete(`${api}/${openId}/entries/${confirm.entry._id}`, { withCredentials: true });
        const message = await mutate(request);
        if (message) return toast.error(message);
        setEntryModal(null);
        toast.success("Entry deleted.");
      } else if (confirm.kind === "delete") {
        const { data } = await axios.delete(`${api}/${openId}`, { withCredentials: true });
        if (!data.success) return toast.error(data.message);
        toast.success("Schedule deleted.");
        setSearchParams({});
      } else {
        const { data } = await axios.delete(`${api}/${openId}/share/${user._id}`, { withCredentials: true });
        if (!data.success) return toast.error(data.message);
        toast.success("You left the schedule.");
        setSearchParams({});
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong.");
    } finally {
      setConfirming(false);
      setConfirm(null);
    }
  };

  // ---- Create / join -----------------------------------------------------

  const closeForms = () => {
    setCreateOpen(false);
    setJoinOpen(false);
    setFormError("");
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return setFormError("Give your schedule a name.");
    setSubmitting(true);
    try {
      const { data } = await axios.post(api, { title, theme: newTheme, country: newCountry }, { withCredentials: true });
      if (data.success) {
        setNewTitle("");
        closeForms();
        toast.success("Schedule created. Add your first class.");
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

  const handleJoin = async (e) => {
    e.preventDefault();
    const shareCode = joinCode.trim().toUpperCase();
    if (!shareCode) return setFormError("Please enter a share code.");
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${api}/join`, { shareCode }, { withCredentials: true });
      if (data.success) {
        setJoinCode("");
        closeForms();
        toast.success("You've joined the schedule.");
        setSearchParams({ s: data.schedule._id });
      } else {
        setFormError(data.message);
      }
    } catch (err) {
      setFormError(err.response?.status === 404 ? "No schedule found with that code." : (err.response?.data?.message || "Couldn't join."));
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render ------------------------------------------------------------

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

  if (openId) {
    return (
      <div className="app app-layout">
        <Header />
        <main className="dashboard">
          <button type="button" className="sched-back" onClick={() => setSearchParams({})}>
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
              <section className="sched-top panel">
                <div className="sched-top-title">
                  <span className="panel-kicker">
                    <CalendarDays size={16} aria-hidden="true" />
                    {isOwner ? "Your schedule" : `Shared by ${schedule.owner?.name || "a friend"}`}
                  </span>
                  <h1>{schedule.title}</h1>
                  {!canEdit && (
                    <p className="sched-hint">You can view this schedule but not change it. Make a copy to edit your own version.</p>
                  )}
                  {role === "editor" && <p className="sched-hint">You can edit this schedule. Changes show up for everyone.</p>}
                </div>

                <div className="sched-actions">
                  {canEdit && (
                    <>
                      <button type="button" className="primary-button" onClick={() => setEntryModal({ kind: "class" })}>
                        <Plus size={18} aria-hidden="true" /> Add class
                      </button>
                      <button type="button" className="secondary-button" onClick={() => setEntryModal({ kind: "activity" })}>
                        <Plus size={18} aria-hidden="true" /> Add activity
                      </button>
                    </>
                  )}
                  {isOwner && (
                    <button type="button" className="secondary-button" onClick={() => setShareOpen(true)}>
                      <Share2 size={18} aria-hidden="true" /> Share
                    </button>
                  )}
                  <button type="button" className="secondary-button" onClick={duplicate}>
                    <Copy size={18} aria-hidden="true" /> {canEdit ? "Duplicate" : "Make a copy"}
                  </button>
                  {isOwner ? (
                    <button type="button" className="remove-friend-btn" onClick={() => setConfirm({ kind: "delete" })}>
                      <Trash2 size={16} aria-hidden="true" /> Delete
                    </button>
                  ) : (
                    <button type="button" className="remove-friend-btn" onClick={() => setConfirm({ kind: "leave" })}>
                      <LogOut size={16} aria-hidden="true" /> Leave
                    </button>
                  )}
                </div>

                <div className="sched-look">
                  <span className="sched-field-label">Look</span>
                  <ThemePicker value={schedule.theme} disabled={!canEdit} onChange={(theme) => updateSettings({ theme })} />
                </div>
              </section>

              <WeekView
                weekStart={weekStart}
                entries={schedule.entries}
                overrides={schedule.holidayOverrides}
                publicByDate={publicByDate}
                canEdit={canEdit}
                onShiftWeek={(n) => setWeekStart((w) => addDays(w, n * 7))}
                onToday={() => setWeekStart(startOfWeek(new Date()))}
                onAddEntry={(date) => setEntryModal({ kind: "class", date })}
                onOpenEntry={(entry) => setEntryModal({ entry, kind: entry.kind })}
                onMarkDay={setMarkDate}
              />

              <HolidayPanel
                year={panelYear}
                country={schedule.country}
                publicHolidays={publicHolidays}
                overrides={schedule.holidayOverrides}
                holidayError={holidayError}
                canEdit={canEdit}
                onCountryChange={(c) => updateSettings({ country: c })}
                onPickDate={setMarkDate}
              />
            </div>
          )}
        </main>
        <Footer />

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
            onUpdated={(next) => { mutationVersion.current += 1; setSchedule(next); }}
            onClose={() => setShareOpen(false)}
          />
        )}
        <ConfirmDialog
          open={Boolean(confirm)}
          tone="danger"
          busy={confirming}
          title={confirm?.kind === "delete" ? "Delete this schedule?" : confirm?.kind === "leave" ? "Leave this schedule?" : "Delete this entry?"}
          confirmLabel={confirm?.kind === "leave" ? "Leave" : "Delete"}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        >
          {confirm?.kind === "delete" && <p>"{schedule?.title}" will be removed for you and everyone you shared it with. This can't be undone.</p>}
          {confirm?.kind === "leave" && <p>You'll lose access to "{schedule?.title}". The owner can share it with you again.</p>}
          {confirm?.kind === "entry" && <p>"{confirm.entry.title}" will be removed from the schedule.</p>}
        </ConfirmDialog>
      </div>
    );
  }

  return (
    <div className="app app-layout">
      <Header />
      <main className="dashboard">
        <section className="hero" id="schedule-hero">
          <div className="hero-copy">
            <span className="eyebrow">Plan your week</span>
            <h1>Your class schedule</h1>
            <p>
              Build a timetable with your classes and everything else you do. Holidays fill in on their own,
              and you can share it with friends or make it look like yours.
            </p>
          </div>
          <aside className="hero-panel">
            <h2>What you can do</h2>
            <ul className="hero-list">
              <li>Add classes, activities, and one-off events</li>
              <li>Attach a picture to any subject</li>
              <li>Edit holidays or mark your own days off</li>
              <li>Share with friends, and pick a theme</li>
            </ul>
          </aside>
        </section>

        <div className="groups-actions">
          <button className="primary-button" onClick={() => { setFormError(""); setCreateOpen(true); }}>
            <Plus size={18} aria-hidden="true" /> New schedule
          </button>
          <button className="secondary-button" onClick={() => { setFormError(""); setJoinOpen(true); }}>
            <Link2 size={18} aria-hidden="true" /> Join with a code
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
        ) : schedules.length === 0 ? (
          <div className="panel" style={{ textAlign: "center" }}>
            <p className="schedule-empty">No schedules yet. Create your first one, or join a friend's with a code.</p>
          </div>
        ) : (
          <div className="groups-grid">
            {schedules.map((s) => (
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
                  <span className="owner-badge">
                    {s.role === "owner" ? "Yours" : s.role === "editor" ? "Can edit" : "View only"}
                  </span>
                </div>
                <p className="group-desc">
                  {s.entryCount} {s.entryCount === 1 ? "entry" : "entries"}
                  {s.role !== "owner" && s.owner?._id !== user?._id && ` · by ${s.owner?.name}`}
                  {s.role === "owner" && s.collaboratorCount > 0 && ` · shared with ${s.collaboratorCount}`}
                </p>
              </button>
            ))}
          </div>
        )}
      </main>
      <Footer />

      {createOpen && (
        <div className="modal-overlay" onClick={closeForms}>
          <form className="modal-content sched-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
            <div className="modal-header">
              <h2>New schedule</h2>
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
                  placeholder="e.g., 1st Semester, Finals week"
                  autoFocus
                />
              </div>
              <div className="form-group full-span">
                <label htmlFor="schedule-country">Country for holidays</label>
                <select id="schedule-country" value={newCountry} onChange={(e) => setNewCountry(e.target.value)}>
                  {COUNTRY_CODES.map((code) => <option key={code} value={code}>{countryName(code)}</option>)}
                </select>
              </div>
              <div className="form-group full-span">
                <span className="sched-field-label">Look</span>
                <ThemePicker value={newTheme} onChange={setNewTheme} />
              </div>
            </div>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="modal-actions sched-modal-actions">
              <button type="button" className="secondary-button" onClick={closeForms}>Cancel</button>
              <button type="submit" className="primary-button" disabled={submitting}>{submitting ? "Creating..." : "Create"}</button>
            </div>
          </form>
        </div>
      )}

      {joinOpen && (
        <div className="modal-overlay" onClick={closeForms}>
          <form className="modal-content sched-modal sched-modal-narrow" onClick={(e) => e.stopPropagation()} onSubmit={handleJoin}>
            <div className="modal-header">
              <h2>Join with a code</h2>
              <button type="button" className="modal-close" onClick={closeForms} aria-label="Close">×</button>
            </div>
            <div className="form-group">
              <label htmlFor="schedule-code">Share code</label>
              <input
                id="schedule-code"
                type="text"
                value={joinCode}
                maxLength={6}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setFormError(""); }}
                placeholder="6 characters"
                autoFocus
                autoComplete="off"
              />
            </div>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="modal-actions sched-modal-actions">
              <button type="button" className="secondary-button" onClick={closeForms}>Cancel</button>
              <button type="submit" className="primary-button" disabled={submitting}>{submitting ? "Joining..." : "Join"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
