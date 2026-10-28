import taskModel from '../models/taskModel.js';
import userModel from '../models/userModel.js';
import { notify } from './notify.js';

const HOUR = 60 * 60 * 1000;
const MAX_LEAD_HOURS = 48;
const CHECK_INTERVAL = 10 * 60 * 1000;

// A task's dueDate is midnight UTC of its due day. Students think of it as due at the end of
// that day in the Philippines (UTC+8), so reminders count down to 23:59 there, which is
// 15:59 UTC of the same date.
const END_OF_DAY_MS = 15 * HOUR + 59 * 60 * 1000;
export const dueMoment = (task) => task.dueDate.getTime() + END_OF_DAY_MS;

const leadLabel = (hours) => (hours >= 48 ? `${hours / 24} days` : `${hours} hours`);

// Sends a "due soon" reminder for every unfinished task that falls inside its owner's
// chosen lead time. Safe to run as often as you like: the dedupe key (task id + due
// date) means each task is announced once, and a changed due date reminds again.
export const runTaskReminders = async (now = new Date()) => {
    const tasks = await taskModel.find({
        isCompleted: false,
        dueDate: {
            $gt: new Date(now.getTime() - END_OF_DAY_MS),
            $lte: new Date(now.getTime() + MAX_LEAD_HOURS * HOUR - END_OF_DAY_MS),
        },
    });
    if (!tasks.length) return 0;

    const owners = await userModel.find({ _id: { $in: [...new Set(tasks.map((t) => String(t.owner)))] } })
        .select('notificationPrefs');
    const prefsByOwner = new Map(owners.map((u) => [String(u._id), u.notificationPrefs]));

    let sent = 0;
    for (const task of tasks) {
        const prefs = prefsByOwner.get(String(task.owner));
        if (!prefs || prefs.taskReminders === false) continue;

        const lead = prefs.reminderLeadHours || 24;
        const msLeft = dueMoment(task) - now.getTime();
        if (msLeft <= 0 || msLeft > lead * HOUR) continue;

        const created = await notify({
            recipients: [task.owner],
            type: 'task_reminder',
            title: 'Task due soon',
            message: `"${task.title}"${task.course ? ` (${task.course})` : ''} is due in less than ${leadLabel(lead)}.`,
            link: '/dashboard',
            dedupeKey: `task:${task._id}:${task.dueDate.getTime()}`,
        });
        sent += created.length;
    }
    return sent;
};

// Runs once shortly after boot and then on a timer. unref() so it never keeps a
// process (or a test run) alive on its own.
export const startReminderJob = () => {
    const run = () => runTaskReminders().catch((error) => console.error('Reminder job failed:', error.message));
    setTimeout(run, 15 * 1000).unref();
    return setInterval(run, CHECK_INTERVAL).unref();
};
