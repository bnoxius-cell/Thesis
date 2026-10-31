import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/pages/authentication/AuthContext";

// Layout route for every signed-in page. A signed-out visitor goes to sign-in, which gets the
// full address they wanted (path, query and hash) in `state.from` and sends them back after.
export default function RequireAuth() {
  const { isLoggedin } = useAuth();
  const { pathname, search, hash } = useLocation();
  if (isLoggedin) return <Outlet />;
  return <Navigate to="/" replace state={{ from: pathname + search + hash }} />;
}
