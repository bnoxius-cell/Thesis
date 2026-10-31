import { ArrowLeft } from "lucide-react";
import { IconButton } from "@/shared/ui";
import usePageTitle from "../usePageTitle";
import HeaderTools from "./HeaderTools";
import useStuck from "./useStuck";
import "./shell.css";

// Every signed-in page renders through this: the header (the page's one h1, an optional action,
// subtitle and back link, then the search, the bell and the avatar menu) and the page body below it.
//   title     the h1, also the browser tab title
//   subtitle  a quiet line under the title (Home's date)
//   action    a node next to the title, usually an AddButton
//   back      { to, label } shows a back arrow before the title; label says where it goes
export default function Page({ title, subtitle, action, back, children }) {
  usePageTitle(title);
  const [sentinel, stuck] = useStuck();

  return (
    <div className="shell-pagewrap">
      <span ref={sentinel} className="shell-pagewrap__sentinel" aria-hidden="true" />
      <header className="shell-header" data-stuck={stuck || undefined}>
        <div className="shell-header__inner">
          {back && <IconButton to={back.to} icon={ArrowLeft} label={back.label} plain />}
          <div className="shell-header__main">
            <div className="shell-header__row">
              <h1 className="shell-header__title">{title}</h1>
              {action}
            </div>
            {subtitle && <p className="shell-header__subtitle">{subtitle}</p>}
          </div>
          <HeaderTools />
        </div>
      </header>
      <div className="shell-body">{children}</div>
    </div>
  );
}
