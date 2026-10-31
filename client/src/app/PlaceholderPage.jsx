import { Hammer } from "lucide-react";
import { Button, EmptyState } from "@/shared/ui";
import { useAuth } from "@/pages/authentication/AuthContext";
import Page from "./shell/Page";
import usePageTitle from "./usePageTitle";

// Stands in for a page that is still being redrawn, so every link in the app lands somewhere.
// `title` is the page's h1; `heading` and `body` reword the message (the 404 page uses them).
// `shell` draws it inside the signed-in shell (header, bell, avatar menu); without it the page
// is bare, for the public layout.
export default function PlaceholderPage({
  title,
  heading = "We're redrawing this page",
  body = "It'll be back soon.",
  shell = false,
}) {
  const { isLoggedin } = useAuth();

  const message = (
    <EmptyState
      page
      icon={Hammer}
      title={heading}
      actions={<Button to={isLoggedin ? "/home" : "/"}>{isLoggedin ? "Go to Home" : "Sign in"}</Button>}
    >
      {body}
    </EmptyState>
  );

  if (shell) return <Page title={title}>{message}</Page>;
  return <BarePlaceholder title={title}>{message}</BarePlaceholder>;
}

function BarePlaceholder({ title, children }) {
  usePageTitle(title);
  return (
    <div className="shell-placeholder">
      <h1 className="shell-placeholder__title">{title}</h1>
      {children}
    </div>
  );
}
