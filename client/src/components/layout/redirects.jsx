import { Navigate, generatePath, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../pages/authentication/AuthContext';

// Old paths keep working forever (bookmarks, shared links, stored notification links, push clicks).
// Each one lands on its new path with the query string and #hash kept.

// `to` may hold route params (`/study/subjects/:id`). `rewrite(params)` can change the query in place
// and return a different path for the few links that move between pages instead of just renaming.
export function RedirectWithQuery({ to, rewrite }) {
  const { search, hash } = useLocation();
  const routeParams = useParams();
  const params = new URLSearchParams(search);
  const path = rewrite?.(params) || generatePath(to, routeParams);
  const query = params.toString();
  return <Navigate to={`${path}${query ? `?${query}` : ''}${hash}`} replace />;
}

// Settings now lives in Me. Old bookmarks go to the appearance section of the own profile.
export function SettingsRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?._id ? `/profile/${user._id}#appearance` : '/profile'} replace />;
}
