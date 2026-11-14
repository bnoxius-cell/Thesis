import { useNavigate } from "react-router-dom";
import GuideTopics from "@/features/guide/GuideTopics.jsx";
import useGuide from "@/features/guide/useGuide";
import useHashScroll from "@/shared/hooks/useHashScroll";
import { SUPPORT_EMAILS } from "@/pages/legal/legalContent";
import { HELP_CONTACTS, isPlaceholder } from "@/utils/helpContacts";
import { Button } from "@/shared/ui";
import SettingsRow, { SettingsGroup } from "./SettingsRow";

// What each address is for, in the order of SUPPORT_EMAILS.
const EMAIL_HINTS = ["Questions about the app", "Report a problem"];

// Help (Figma 290:16048, phone 292:2433): who to talk to, how to reach the team, and the About page.
// Placeholder contacts are shown exactly as written, muted, until the team fills them in.
export default function HelpTab() {
  const { guide, showSetup } = useGuide();
  const navigate = useNavigate();
  useHashScroll(); // /settings/help#guide-<key>: GuideTopics opens that topic, this scrolls to it
  const showAgain = () => {
    showSetup();
    navigate("/home");
  };

  return (
    <>
      <SettingsGroup title="Guides">
        <p className="settings-group__lead">Short how-tos for getting around StressCare.</p>
        <SettingsRow label="Take the tour again" hint="A quick look at where everything is.">
          <Button variant="secondary" to="/home?tour=1">Start</Button>
        </SettingsRow>
        {guide?.setupHidden && !guide.setupDone && (
          <SettingsRow label="Get started list" hint="Hidden on Home. Bring it back any time.">
            <Button variant="secondary" onClick={showAgain}>Show on Home</Button>
          </SettingsRow>
        )}
        <GuideTopics />
      </SettingsGroup>
      <SettingsGroup title="Talk to someone">
        {HELP_CONTACTS.map(({ name, detail }) => (
          <SettingsRow key={name} label={name} hint={detail} muted={isPlaceholder(detail)} />
        ))}
      </SettingsGroup>
      <SettingsGroup title="Email the team">
        {SUPPORT_EMAILS.map((email, i) => (
          <SettingsRow key={email} label={<span className="settings-row__wrap">{email}</span>} hint={EMAIL_HINTS[i]}>
            <Button variant="secondary" href={`mailto:${email}`} aria-label={`Email ${email}`}>Email</Button>
          </SettingsRow>
        ))}
      </SettingsGroup>
      <SettingsGroup title="About">
        <SettingsRow label="About StressCare" hint="What it does and how the numbers work.">
          <Button variant="ghost" to="/about">Open</Button>
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}
