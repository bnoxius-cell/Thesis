import { useEffect } from "react";

// Sets the browser tab title to "<title> · StressCare" while the page is on screen.
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · StressCare` : "StressCare";
  }, [title]);
}
