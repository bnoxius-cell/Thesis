import { Navigate, useLocation } from "react-router-dom";

// Sends an old address to its new home in place of the old history entry. The rest of the query
// string comes along; `set` adds or replaces params and `drop` removes the ones the new page no
// longer reads.
export default function RedirectTo({ to, set = {}, drop = [] }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  drop.forEach((key) => params.delete(key));
  Object.entries(set).forEach(([key, value]) => params.set(key, value));
  const query = params.toString();
  return <Navigate to={{ pathname: to, search: query && `?${query}` }} replace />;
}
