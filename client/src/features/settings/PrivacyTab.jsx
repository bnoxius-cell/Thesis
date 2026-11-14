import { Link } from "react-router-dom";
import { useAuth } from "@/pages/authentication/AuthContext";
import { SUPPORT_EMAILS } from "@/pages/legal/legalContent";
import SettingsRow, { SettingsGroup } from "./SettingsRow";

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

// A "Read" link that opens a legal page and comes back here (LegalPage reads `state.from`).
const ReadLink = ({ to, label }) => (
  <Link
    to={to}
    state={{ from: "/settings/privacy" }}
    className="ui-btn ui-btn--ghost ui-btn--md"
    aria-label={`Read the ${label}`}
  >
    <span>Read</span>
  </Link>
);

// Privacy (Figma 290:15766, phone 292:2270): the agreement with links to the real text, what other
// students can see, and how to ask for the account to be deleted.
export default function PrivacyTab() {
  const { userData } = useAuth();
  const agreed = userData?.termsAcceptedAt ? formatDate(userData.termsAcceptedAt) : null;

  return (
    <>
      <SettingsGroup title="Your agreement">
        <SettingsRow label="Terms of Service" hint={agreed && `You agreed on ${agreed}.`}>
          <ReadLink to="/terms-of-service" label="Terms of Service" />
        </SettingsRow>
        <SettingsRow label="Privacy Policy" hint="How StressCare handles your data.">
          <ReadLink to="/privacy-policy" label="Privacy Policy" />
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup title="What others can see">
        <SettingsRow label="Name, picture, program and bio" hint="Friends and group members can see these." />
        <SettingsRow label="Never shared" hint="Your email and your check-in results stay private." />
      </SettingsGroup>
      {/* Interim: until the server can delete an account, ask by email. The Delete my account row replaces this one. */}
      <SettingsGroup title="Delete your account">
        <SettingsRow
          label="To delete your account, email us at"
          hint={<a href={`mailto:${SUPPORT_EMAILS[0]}`}>{SUPPORT_EMAILS[0]}</a>}
        />
      </SettingsGroup>
    </>
  );
}
