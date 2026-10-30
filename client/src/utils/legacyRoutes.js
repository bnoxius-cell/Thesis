// Query rewrites for the old paths that RedirectWithQuery (components/layout/redirects.jsx) sends elsewhere.
// Each one edits the query in place and returns a new path when the link moves to a different page.

// /schedule?tab=tasks became /plan?view=tasks.
export const rewriteScheduleQuery = (params) => {
  if (params.get('tab') !== 'tasks') return null;
  params.delete('tab');
  params.set('view', 'tasks');
  return null;
};

// /reviewers?r=<id> became a path of its own.
export const rewriteReviewersQuery = (params) => {
  const id = params.get('r');
  if (!id) return null;
  params.delete('r');
  return `/study/reviewers/${encodeURIComponent(id)}`;
};

// Friends was its own page, now a tab of People.
export const rewriteFriendsQuery = (params) => {
  params.set('tab', 'friends');
  return null;
};
