import StudyTabs from "@/features/study/StudyTabs";

// The Study tab track on a Files page, with the page's own buttons at the right (children).
export default function FilesTabsRow({ library, className = "", children }) {
  return (
    <div className={`files-tabsrow ${className}`.trim()}>
      <StudyTabs value="files" subjectsCount={library.locations?.subjects.length} />
      {children}
    </div>
  );
}
