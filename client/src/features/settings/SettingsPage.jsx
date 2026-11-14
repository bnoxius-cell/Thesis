import { Link, Navigate, useParams } from "react-router-dom";
import { Hammer } from "lucide-react";
import { Badge, Button, EmptyState } from "@/shared/ui";
import Page from "@/app/shell/Page";
import useMediaQuery from "@/shared/hooks/useMediaQuery";
import WhatsNewContent from "@/features/whats-new/WhatsNewContent";
import useWhatsNew from "@/features/whats-new/useWhatsNew";
import AccountTab from "./AccountTab";
import SettingsList from "./SettingsList";
import SettingsTab from "./SettingsTab";
import { SECTIONS, sectionFor, sectionPath } from "./settingsSections";
import "./settings.css";

// Privacy and Help are still being redrawn.
const Redrawing = () => (
  <EmptyState icon={Hammer} title="We're redrawing this part">It'll be back soon.</EmptyState>
);

const BODIES = {
  settings: SettingsTab,
  account: AccountTab,
  privacy: Redrawing,
  help: Redrawing,
  "whats-new": WhatsNewContent,
};

// /settings and /settings/:section. From 1024px a list of areas sits left of the open one; on a phone
// /settings is the list and each area is its own screen with a back arrow (the preferences area lives
// at /settings/general there). An address that is not an area shows the list with none lit and a
// way back (frame 290:845).
export default function SettingsPage() {
  const { section } = useParams();
  const phone = useMediaQuery("(max-width: 1023px)");
  const current = sectionFor(section);

  if (section === "settings" || (section === "general" && !phone)) {
    return <Navigate to={sectionPath("settings", phone)} replace />;
  }

  if (!current) {
    return (
      <Page title="Settings" back={phone ? { to: "/settings", label: "Back to Me" } : undefined}>
        <div className="settings">
          {!phone && <SectionNav />}
          <div className="settings__body">
            <EmptyState
              icon={Hammer}
              title="That page isn't here"
              actions={<Button to="/settings">Go to Settings</Button>}
            >
              It may have moved. Your settings are one tap away.
            </EmptyState>
          </div>
        </div>
      </Page>
    );
  }

  if (phone && !section) {
    return (
      <Page title="Me">
        <SettingsList />
      </Page>
    );
  }

  const Body = BODIES[current.key];
  return (
    <Page title={current.label} back={phone ? { to: "/settings", label: "Back to Me" } : undefined}>
      <div className="settings">
        {!phone && <SectionNav active={current.key} />}
        <div className="settings__body">
          <Body />
        </div>
      </div>
    </Page>
  );
}

function SectionNav({ active }) {
  const { hasUnseen } = useWhatsNew();
  return (
    <nav aria-label="Settings" className="settings-nav">
      {SECTIONS.map(({ key, label, icon: Icon, dot }) => (
        <Link
          key={key}
          to={sectionPath(key)}
          className="settings-nav__link"
          aria-current={key === active ? "page" : undefined}
        >
          <Icon size={20} aria-hidden="true" />
          <span className="settings-nav__label">{label}</span>
          {dot && hasUnseen && (
            <>
              <Badge dot />
              <span className="sr-only">New updates</span>
            </>
          )}
        </Link>
      ))}
    </nav>
  );
}
