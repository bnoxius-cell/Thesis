import { Segment } from "@/shared/ui";

const OPTIONS = [
  { value: "reviewers", label: "Reviewers" },
  { value: "flashcards", label: "Flashcards" },
];

// The Practice tab's controls in the tab row (Figma 144:654): the Reviewers | Flashcards Segment and,
// on each side its link: "New reviewer" or "Make flashcards". On a phone the Segment fills its own row and the
// link gives way to the dashed card under the list.
export default function PracticeSwitch({ show, onShow, onNew, onMake }) {
  return (
    <>
      <Segment className="study-segment" label="Practice section" options={OPTIONS} value={show} onChange={onShow} />
      {show === "reviewers" && (
        <button type="button" className="study-tabsrow__link" onClick={onNew}>New reviewer</button>
      )}
      {show === "flashcards" && (
        <button type="button" className="study-tabsrow__link" onClick={onMake}>Make flashcards</button>
      )}
    </>
  );
}
