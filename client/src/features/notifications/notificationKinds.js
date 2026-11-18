import {
  AlarmClock,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Info,
  ListChecks,
  MessageSquare,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

// What each notification type looks like in the inbox: its icon (for the chip that stands in when
// there is no person's picture) and a plain label (the row's title when the server sent none).
const KINDS = {
  friend_request: { icon: UserPlus, label: "Friend request" },
  friend_accepted: { icon: UserCheck, label: "Friend request accepted" },
  group_invite: { icon: UserPlus, label: "Group invite" },
  group_message: { icon: MessageSquare, label: "Group message" },
  group_task: { icon: ListChecks, label: "Shared task" },
  group_schedule: { icon: CalendarDays, label: "Group timetable" },
  group_share: { icon: BookOpen, label: "Shared reviewer" },
  group_member: { icon: Users, label: "Group members" },
  task_reminder: { icon: AlarmClock, label: "Task reminder" },
  schedule_share: { icon: CalendarPlus, label: "Timetable shared" },
  schedule_change: { icon: CalendarClock, label: "Timetable changed" },
  schedule_proposal: { icon: CalendarCheck, label: "Class change proposed" },
  system: { icon: Info, label: "StressCare" },
};

// The types where a person did something, so their picture or initial is the better mark.
const FROM_A_PERSON = new Set(["friend_request", "friend_accepted", "group_invite", "group_message", "group_task", "group_member"]);

export const kindOf = (notification) => KINDS[notification.type] ?? KINDS.system;

// True when the row shows the sender's avatar (a person did it and we know who) rather than an icon chip.
export const showsPerson = (notification) => FROM_A_PERSON.has(notification.type) && Boolean(notification.sender);

// True for the Groups filter: the notification belongs to one of the student's groups.
export const isGroupItem = (notification) => notification.group != null;
