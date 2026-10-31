import { Skeleton } from "@/shared/ui";

// What shows inside a layout while a page's code loads, so the shell never goes blank.
export default function PageFallback() {
  return (
    <div className="shell-fallback" role="status">
      <span className="sr-only">Loading</span>
      <Skeleton width="40%" height="32px" />
      <Skeleton height="160px" />
      <Skeleton height="160px" />
    </div>
  );
}
