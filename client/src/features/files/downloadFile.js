import { ensureLink } from "@/shared/lib/fileLinks";
import { cachedFileBlob, loadFileBlob, needsNewTab } from "@/shared/lib/fileBlobs";

// Revoking a download's object URL at once cancels the save in Firefox and Safari.
const REVOKE_MS = 60_000;
const BLOCKED = "Your browser blocked the new tab. Allow pop-ups for StressCare, then try again.";

function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_MS);
}

// The file opens in a new tab: the storage shows a photo there and sends anything else as an
// attachment, which the browser saves. The tab is opened before the wait for a link, while the click
// still counts, or a popup blocker would stop it. With no tab (a blocked popup) the student is asked
// to allow it: the app itself is never sent to the link, which would end any upload still running,
// leave the signed link in the address bar and, on a storage error, replace the app with its page.
async function openInTab(file) {
  const tab = window.open("", "_blank");
  if (!tab) return { error: BLOCKED };
  tab.opener = null;
  const { url, error } = await ensureLink(file.id, "file");
  if (error) {
    tab.close();
    return { error };
  }
  tab.location.replace(url);
  return {};
}

// Saves a file without leaving the page: from the bytes already in memory, or fetched once (plan 23,
// 4.1). A file this tab couldn't fetch or can't show opens in a new tab instead. Call it
// straight from the click, so a tab opened before anything waits isn't blocked. Answers {} or
// { error } with a message to show.
export async function downloadFile(file) {
  const cached = cachedFileBlob(file.id);
  if (cached) {
    save(cached, file.name);
    return {};
  }
  if (needsNewTab(file.id)) return openInTab(file);

  const result = await loadFileBlob(file);
  if (result.blob) {
    save(result.blob, file.name);
    return {};
  }
  if (result.aborted) return {};
  if (result.fallback) return openInTab(file);
  return { error: result.error };
}
