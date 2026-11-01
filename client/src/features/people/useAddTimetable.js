import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { importSharedTimetable } from "@/shared/api/schedules";

// Adds a timetable posted in a group's chat to the student's own plan. `add()` copies every entry
// into their main timetable, then calls `onAdded(messageId)`; a toast says why if it fails.
export default function useAddTimetable(groupId, message, onAdded) {
  const [busy, setBusy] = useState(false);

  const add = useCallback(async () => {
    setBusy(true);
    const res = await importSharedTimetable(groupId, message._id, message.schedule.entries.map((e) => e._id));
    setBusy(false);
    if (!res.data) {
      toast.error(res.error);
      return;
    }
    toast.success("Added to your plan.");
    onAdded(message._id);
  }, [groupId, message, onAdded]);

  return { busy, add };
}
