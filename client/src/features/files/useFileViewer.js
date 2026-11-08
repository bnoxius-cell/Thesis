import { useCallback, useEffect, useRef } from "react";
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
// pasted links reopen it once the list has loaded. A file that isn't in this page's library gets a
// toast and the param is dropped. `library` is useLibrary's answer.
//   file   the library row being viewed, or null
//   open   (file) => opens it
//   close  () => closes it
export default function useFileViewer(library) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const closing = useRef(null); // the id just closed, so a delete that removes its row doesn't toast
  const id = params.get(PARAM);
  const file = id ? (library.files.find((row) => row.id === id) ?? null) : null;
  const pushed = Boolean(location.state?.fileViewer);

  const open = useCallback(
    (row) => {
      closing.current = null;
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
    if (pushed) navigate(-1);
    else setParams(withoutFile, { replace: true });
  }, [id, pushed, navigate, setParams]);

  const missing = Boolean(id) && !file && library.status === "ready";
  useEffect(() => {
    if (!missing || closing.current === id) return;
    toast.info(GONE, { toastId: "file-gone" }); // one toast, also when StrictMode runs this twice
    setParams(withoutFile, { replace: true });
  }, [missing, id, setParams]);

  return { file, open, close };
}
