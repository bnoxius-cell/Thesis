// A file's size for people: "890 KB", "2.1 MB", "100 MB". Nothing at all reads "0 MB" (Figma 160:3115);
// anything else is never "0 KB", and a whole number of megabytes drops the ".0". Megabytes round up,
// so a file just over a limit never reads as the limit.
export function formatSize(bytes) {
  if (bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const megabytes = Math.ceil((bytes / (1024 * 1024)) * 10) / 10;
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}
