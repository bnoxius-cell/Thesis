import { useSearchParams } from 'react-router-dom';

// Which tab is showing, kept in the `?tab=` query so a refresh or a shared link lands on it.
// An unknown or missing value falls back to the first tab.
export function useTabParam(ids, param = 'tab') {
  const [params, setParams] = useSearchParams();
  const raw = params.get(param);
  const current = ids.includes(raw) ? raw : ids[0];
  const setCurrent = (id) => {
    const next = new URLSearchParams(params);
    if (id === ids[0]) next.delete(param);
    else next.set(param, id);
    setParams(next, { replace: true });
  };
  return [current, setCurrent];
}
