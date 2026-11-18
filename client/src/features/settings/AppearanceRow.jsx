import { useState } from "react";
import { Segment } from "@/shared/ui";
import { useTheme } from "@/context/ThemeContext";
import { readMotionPref, setMotionPref } from "@/utils/motion";
import SettingsRow, { SettingsGroup } from "./SettingsRow";

const CHOICES = [
  { value: "on", label: "On" },
  { value: "system", label: "Match device" },
  { value: "off", label: "Off" },
];

const THEMES = [
  { value: "light", label: "Light" },
  { value: "system", label: "Match device" },
  { value: "dark", label: "Dark" },
];

// Theme and Animations live in this browser only, so they never wait on the server.
export default function AppearanceRow() {
  const { mode, setTheme } = useTheme();
  const [motion, setMotion] = useState(readMotionPref);
  const choose = (value) => {
    setMotionPref(value);
    setMotion(value);
  };
  return (
    <SettingsGroup title="Appearance">
      <SettingsRow label="Theme" hint="On this device" stacked>
        {(labelId) => <Segment className="settings-segment" labelId={labelId} options={THEMES} value={mode} onChange={setTheme} />}
      </SettingsRow>
      <SettingsRow label="Animations" hint="On this device" stacked>
        {(labelId) => <Segment className="settings-segment" labelId={labelId} options={CHOICES} value={motion} onChange={choose} />}
      </SettingsRow>
    </SettingsGroup>
  );
}
