import { useState } from "react";
import { Segment } from "@/shared/ui";
import { readMotionPref, setMotionPref } from "@/utils/motion";
import SettingsRow, { SettingsGroup } from "./SettingsRow";

const CHOICES = [
  { value: "on", label: "On" },
  { value: "system", label: "Match device" },
  { value: "off", label: "Off" },
];

// The Animations switch lives in this browser only, so it never waits on the server.
export default function AppearanceRow() {
  const [motion, setMotion] = useState(readMotionPref);
  const choose = (value) => {
    setMotionPref(value);
    setMotion(value);
  };
  return (
    <SettingsGroup title="Appearance">
      <SettingsRow label="Animations" hint="On this device" stacked>
        {(labelId) => <Segment labelId={labelId} options={CHOICES} value={motion} onChange={choose} />}
      </SettingsRow>
    </SettingsGroup>
  );
}
