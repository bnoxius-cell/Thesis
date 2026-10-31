import { fromISODate } from "@/utils/scheduleUtils";

// "Fri, Oct 30" from a YYYY-MM-DD string.
export const shortDate = (iso) =>
  fromISODate(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
