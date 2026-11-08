import { ensureLink } from "@/shared/lib/fileLinks";
import { blobFetchBroken, cachedFileBlob, loadFileBlob } from "@/shared/lib/fileBlobs";
import { isPhoto } from "./fileRules";

// Revoking a download's object URL at once cancels the save in Firefox and Safari.
const REVOKE_MS = 60_000;

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

// The photo opens in a new tab: the storage serves a photo inline, so the browser shows it there and
// the photo is saved from that tab. The tab is opened before the wait for a link, while the click
// still counts, or a popup blocker would stop it. With no tab (a blocked popup) the student is asked
// to allow it: sending the app itself to the photo would end any upload still running and leave the
// signed link in the address bar.
async function openPhotoInTab(file) {
  const tab = window.open("", "_blank");
  if (!tab) return { error: "Your browser blocked the new tab. Allow pop-ups for StressCare, then try again." };
  tab.opener = null;
  const { url, error } = await ensureLink(file.id, "file");
  if (error) {
    tab.close();
    return { error };
  }
  tab.location.replace(url);
  return {};
}

// Anything else goes to its link: the storage sends documents as an attachment, so the page stays.
// The link goes straight to `location.assign` and is never kept.
async function navigateToLink(file) {
  const { url, error } = await ensureLink(file.id, "file");
  if (error) return { error };
  window.location.assign(url);
  return {};
}

const legacyDownload = (file) => (isPhoto(file.ext) ? openPhotoInTab(file) : navigateToLink(file));

// Saves a file without leaving the page: from the bytes already in memory, or fetched once (plan 23,
// 4.1). When this tab can't fetch from the storage it falls back to the plain download above. Call it
// straight from the click: when the fetch is already known to be broken, a photo's tab has to open
// before anything waits. Answers {} or { error } with a message to show.
export async function downloadFile(file) {
  const cached = cachedFileBlob(file.id);
  if (cached) {
    save(cached, file.name);
    return {};
  }
  if (blobFetchBroken()) return legacyDownload(file);

  const result = await loadFileBlob(file);
  if (result.blob) {
    save(result.blob, file.name);
    return {};
  }
  if (result.fallback) return legacyDownload(file);
  if (result.aborted) return {};
  return { error: result.error };
}
