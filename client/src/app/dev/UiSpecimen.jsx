import { Bell, Plus } from "lucide-react";
import { AddButton, Avatar, Badge, Button, Card, Chip, IconButton } from "@/shared/ui";
import "./ui-specimen.css";

const VARIANTS = ["primary", "secondary", "ghost", "danger"];
const TONES = ["accent", "good", "watch", "danger", "neutral"];

function Section({ title, children }) {
  return (
    <section className="specimen-section">
      <h2>{title}</h2>
      <div className="specimen-row">{children}</div>
    </section>
  );
}

// Every shared primitive in every state. Development only: App.jsx mounts it at /dev/ui.
export default function UiSpecimen() {
  return (
    <main id="main" className="specimen">
      <h1>UI specimen</h1>

      <Section title="Button">
        {VARIANTS.map((v) => (
          <Button key={v} variant={v}>{v}</Button>
        ))}
        {VARIANTS.map((v) => (
          <Button key={`${v}-sm`} variant={v} size="sm">{v} sm</Button>
        ))}
        <Button icon={Plus}>With icon</Button>
        <Button busy>Saving</Button>
        <Button disabled>Disabled</Button>
        <Button to="/">As a link</Button>
      </Section>

      <Section title="IconButton, AddButton">
        <IconButton label="Notifications" icon={Bell} />
        <IconButton label="Notifications, 3 new" icon={Bell} badge={3} />
        <IconButton label="Notifications, many new" icon={Bell} badge={120} />
        <AddButton label="Add a reviewer" />
      </Section>

      <Section title="Chip">
        {TONES.map((t) => (
          <Chip key={t} tone={t}>{t}</Chip>
        ))}
        <Chip tone="good" icon={Plus}>With icon</Chip>
      </Section>

      <Section title="Badge">
        <Badge count={3} />
        <Badge count={42} />
        <Badge count={120} />
        <Badge count={0} />
      </Section>

      <Section title="Avatar">
        <Avatar name="Tony" />
        <Avatar name="Tony" size="lg" />
        <Avatar name="Tony" size="xl" />
        <Avatar name="Broken picture" src="/missing.png" />
      </Section>

      <Section title="Card">
        <Card>
          <strong>Card title</strong>
          <span>One short sentence of body text.</span>
        </Card>
        <Card as="button" type="button" interactive>
          <strong>Interactive card</strong>
          <span>Lifts 2px on hover with a mouse.</span>
        </Card>
      </Section>
    </main>
  );
}
