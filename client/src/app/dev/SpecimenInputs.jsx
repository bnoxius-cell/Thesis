import { useState } from "react";
import { LogOut, Settings, Trash2, User } from "lucide-react";
import { Button, Field, Menu, MenuDivider, MenuItem, Segment, SelectButton, Tabs } from "@/shared/ui";
import Section from "./Section";

const HOURS = [1, 2, 3, 4, 5, 6].map((h) => ({ value: h, label: `${h} ${h === 1 ? "hour" : "hours"}` }));
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const minutes = i * 30;
  const h = Math.floor(minutes / 60) % 12 || 12;
  const m = minutes % 60 === 0 ? "00" : "30";
  return { value: minutes, label: `${h}:${m} ${minutes < 720 ? "am" : "pm"}` };
});
const PACES = [
  { value: "relaxed", label: "Relaxed" },
  { value: "balanced", label: "Balanced" },
  { value: "intense", label: "Intense" },
];
const SIZES = [
  { value: "mc", label: "Multiple choice" },
  { value: "mixed", label: "Mixed" },
  { value: "short", label: "Short answer" },
];
const TABS = [
  { value: "groups", label: "Groups", count: 2 },
  { value: "friends", label: "Friends", count: 120 },
  { value: "plain", label: "No count" },
];

// Field, SelectButton, Segment, Tabs and Menu in their states.
export default function SpecimenInputs() {
  const [hours, setHours] = useState(3);
  const [bed, setBed] = useState(null);
  const [nativeTime, setNativeTime] = useState(1350);
  const [pace, setPace] = useState("balanced");
  const [size, setSize] = useState(null);
  const [tab, setTab] = useState("groups");
  const [blockTab, setBlockTab] = useState("friends");
  const [picked, setPicked] = useState("Nothing yet");
  const [layout, setLayout] = useState("week");
  const [timetable, setTimetable] = useState("My week");

  return (
    <>
      <Section title="Field">
        <div className="specimen-stack">
          <Field label="Title" placeholder="Databases notes" />
          <Field label="Email" type="email" hint="We only use it to sign you in." placeholder="you@olfu.edu.ph" />
          <Field label="Code" defaultValue="AB12" error="That code isn't right. Check it and try again." />
          <Field label="Notes" multiline placeholder="Anything to remember" />
          <Field label="Disabled" disabled defaultValue="Can't edit" />
        </div>
      </Section>

      <Section title="SelectButton">
        <SelectButton options={HOURS} value={hours} onChange={setHours} label="Study hours" />
        <SelectButton options={TIMES} value={bed} onChange={setBed} placeholder="Pick a time" label="Bedtime" />
        <SelectButton options={HOURS} value={1} disabled onChange={() => {}} />
        <div className="specimen-stack">
          <Field label="Study hours a day">
            {(control) => <SelectButton {...control} block options={HOURS} value={hours} onChange={setHours} />}
          </Field>
          <Field label="Usual bedtime (long list scrolls)">
            {(control) => <SelectButton {...control} block options={TIMES} value={bed} onChange={setBed} placeholder="Pick a time" />}
          </Field>
          <Field label="Wake time (native select)">
            {(control) => <SelectButton {...control} native block options={TIMES} value={nativeTime} onChange={setNativeTime} />}
          </Field>
        </div>
      </Section>

      <Section title="Segment">
        <div className="specimen-stack">
          <Field label="Pace">{(control) => <Segment {...control} options={PACES} value={pace} onChange={setPace} />}</Field>
          <Field label="Questions (nothing chosen, long labels)">
            {(control) => <Segment {...control} options={SIZES} value={size} onChange={setSize} />}
          </Field>
          <Segment label="Layout" options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "tasks", label: "Tasks" }]} value={layout} onChange={setLayout} />
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs label="Social" items={TABS} value={tab} onChange={setTab} />
        <Tabs label="Social, full width" block items={TABS.slice(0, 2)} value={blockTab} onChange={setBlockTab} />
        <Tabs
          label="Link tabs"
          items={[
            { value: "a", label: "Link A", to: "/dev/ui#a" },
            { value: "b", label: "Link B", to: "/dev/ui#b" },
          ]}
          value="a"
        />
      </Section>

      <Section title="Menu">
        <Menu
          label="Account"
          trigger={(menu) => (
            <Button variant="secondary" {...menu}>
              Account menu
            </Button>
          )}
        >
          <MenuItem icon={User} to="/dev/ui#profile">Profile</MenuItem>
          <MenuItem icon={Settings} onSelect={() => setPicked("Settings")}>Settings</MenuItem>
          <MenuDivider />
          <MenuItem icon={Trash2} tone="danger" onSelect={() => setPicked("Delete")}>Delete everything</MenuItem>
          <MenuItem icon={LogOut} onSelect={() => setPicked("Log out")}>Log out</MenuItem>
        </Menu>
        <Menu
          label="Timetable"
          trigger={(menu) => (
            <Button variant="secondary" {...menu}>
              With checks
            </Button>
          )}
        >
          {["My week", "BSIT 3-A", "Study group"].map((name) => (
            <MenuItem key={name} selected={name === timetable} onSelect={() => setTimetable(name)}>{name}</MenuItem>
          ))}
        </Menu>
        <span className="specimen-note">Last pick: {picked}</span>
        <div className="specimen-right">
          <Menu
            align="end"
            label="Right edge"
            trigger={(menu) => (
              <Button variant="secondary" {...menu}>
                Right edge
              </Button>
            )}
          >
            <MenuItem icon={User}>A fairly long row to push the menu past the edge</MenuItem>
            <MenuItem icon={Settings}>Second row</MenuItem>
          </Menu>
        </div>
      </Section>
    </>
  );
}
