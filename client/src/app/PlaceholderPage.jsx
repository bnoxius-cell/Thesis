import { Hammer } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";
import { useAuth } from "@/pages/authentication/AuthContext";
import usePageTitle from "./usePageTitle";

// Stands in for a page that is still being redrawn, so every link in the app lands somewhere.
// `title` is the page's h1; `heading` and `body` reword the message (the 404 page uses them).
export default function PlaceholderPage({
  title,
  heading = "We're redrawing this page",
  body = "It'll be back soon.",
}) {
  const { isLoggedin, logout } = useAuth();
  usePageTitle(title);

  return (
    <div className="shell-placeholder">
      <h1 className="shell-placeholder__title">{title}</h1>
      <EmptyState
        page
        icon={Hammer}
        title={heading}
        actions={
          <>
            <Button to={isLoggedin ? "/home" : "/"}>{isLoggedin ? "Go to Home" : "Sign in"}</Button>
            {/* Temporary until the header's avatar menu (F4) carries Log out. */}
            {isLoggedin && <Button variant="ghost" onClick={() => logout()}>Log out</Button>}
          </>
        }
      >
        {body}
      </EmptyState>
    </div>
  );
}
