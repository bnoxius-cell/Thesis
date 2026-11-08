import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

const PARAM = "file";
const GONE = "That file isn't here anymore.";

const withoutFile = (params) => {
  const next = new URLSearchParams(params);
  next.delete(PARAM);
  return next;
};

// Which file the viewer shows, kept in the page's query as ?file=<id> beside whatever else is there
// (the Study tab). Opening pushes one history entry, so Back closes the viewer; Close goes back when
// the viewer pushed that entry and otherwise (a pasted link) drops the param in place. Reload and
// pasted links reopen it once the list has loaded. A file that isn't one this page shows gets a
// toast and the param is dropped. Call it once per page, outside any list, so that also happens on a
// page with no files. `library` is useLibrary's answer; `viewable` are the files this page shows (all
// of them on the hub, which searches everything; one place's on a folder or subject page).
//   file   the row being viewed, or null. After keep(file) it is that copy, so the viewer stays on a
//          file that moved out of this page's files
//   keep   (file) => holds the viewed file's newest copy (a move's answer)
//   open   (file) => opens it
//   close  () => closes it
export default function useFileViewer(library, viewable) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const closing = useRef(null); // the id just closed, so a delete that removes its row doesn't toast
  const [kept, setKept] = useState(null); // the newest copy of the viewed file, once it has moved
  const id = params.get(PARAM);
  const file = kept?.id === id ? kept : id ? (viewable.find((row) => row.id === id) ?? null) : null;
  const pushed = Boolean(location.state?.fileViewer);

  const open = useCallback(
    (row) => {
      closing.current = null;
      setKept(null);
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(PARAM, row.id);
          return next;
        },
        { state: { fileViewer: true } },
      );
    },
    [setParams],
  );

  const close = useCallback(() => {
    closing.current = id;
    setKept(null);
    if (pushed) navigate(-1);
    else setParams(withoutFile, { replace: true });
  }, [id, pushed, navigate, setParams]);

  const missing = Boolean(id) && !file && library.status === "ready";
  useEffect(() => {
    if (!missing || closing.current === id) return;
    toast.info(GONE, { toastId: "file-gone" }); // one toast, also when StrictMode runs this twice
    setParams(withoutFile, { replace: true });
  }, [missing, id, setParams]);

  return { file, open, close, keep: setKept };
}
