// One calm line of good news under the cards. Hidden until something has been finished.
export default function QuietLine({ finished }) {
  if (finished === 0) return null;
  return (
    <p className="home-quiet">
      You finished {finished} {finished === 1 ? "task" : "tasks"} in the last 7 days.
    </p>
  );
}
