// Turns the link stored on a notification into a path inside the app, or null when it can't be opened.
// Rows written before the Notifications rebuild still hold the old site's paths (/groups?g=<id>,
// /schedule?s=<id>, /friends, /dashboard), so those are mapped to where the page lives now. Any other
// path inside the app (the server writes the new ones) passes through untouched.
// Pure and with no imports, because the server's tests load this file too.

export function toAppLink(link) {
  if (typeof link !== "string") return null;
  const value = link.trim();
  // Only a path on this site: nothing with a host, a scheme or the "//" and "/\" forms browsers read as one.
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;

  const at = value.indexOf("?");
  const path = at === -1 ? value : value.slice(0, at);
  const params = new URLSearchParams(at === -1 ? "" : value.slice(at + 1));

  switch (path) {
    case "/friends":
      return "/people/friends";
    case "/groups": {
      const id = params.get("g");
      return id ? `/people/groups/${encodeURIComponent(id)}` : "/people";
    }
    case "/schedule": {
      const id = params.get("s");
      return id ? `/plan?timetable=${encodeURIComponent(id)}` : "/plan";
    }
    case "/dashboard":
      return "/home";
    default:
      return value;
  }
}
