import { Tabs } from "@/shared/ui";
import useSelectedTabInView from "@/shared/hooks/useSelectedTabInView";
import "./study-tabs.css";

// The Study tab track (Figma 72:3, 144:654, 150:924): Subjects | Practice | Files, one link each.
// `value` is "subjects", "practice" or "files"; `subjectsCount` is the badge on Subjects. Every tab
// controls the page's one panel (`id="study-panel"`), which the page labels with `study-tab-<value>`.
export default function StudyTabs({ value, subjectsCount }) {
  useSelectedTabInView(`study-tab-${value}`, true);
  const items = [
    { value: "subjects", label: "Subjects", count: subjectsCount, to: "/study" },
    { value: "practice", label: "Practice", to: "/study/practice" },
    { value: "files", label: "Files", to: "/study/files" },
  ].map((item) => ({ ...item, id: `study-tab-${item.value}`, panelId: "study-panel" }));
  return <Tabs items={items} value={value} label="Study sections" className="study-tabs" />;
}
