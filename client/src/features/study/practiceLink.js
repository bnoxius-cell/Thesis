// Where Learning Mode lives for one reviewer. `mode` is "all" or "weak". The page the student
// came from rides along as `state.from`, so Exit on the practice screen can bring them back.
// Without `fresh`, an open session is picked up where it was left; `fresh` starts a new one.
export function practiceLink(reviewerId, mode, from, { fresh = false } = {}) {
  const query = `mode=${mode}${fresh ? "&new=1" : ""}`;
  return { to: `/study/reviewers/${reviewerId}/practice?${query}`, state: { from } };
}
