// Where Learning Mode lives for one reviewer. `mode` is "all" or "weak". The page the student
// came from rides along as `state.from`, so Exit on the practice screen can bring them back.
export function practiceLink(reviewerId, mode, { pathname, search }) {
  return { to: `/study/reviewers/${reviewerId}/practice?mode=${mode}`, state: { from: pathname + search } };
}
