import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "@/shared/ui";
import { GUIDE_TOPICS, guideId } from "./guideTopics.js"; // with the extension: GuideTopics.jsx differs only by case, which Windows treats as the same name
import "./guide-topics.css";

// One how-to: a native <details>, so Enter and Space, the keyboard and screen readers work without
// state. `hash` opens it when the address names it (the header search and shared links).
function GuideTopic({ topic, hash }) {
  const ref = useRef(null);
  const id = guideId(topic.key);

  useEffect(() => {
    if (hash === `#${id}`) ref.current.open = true;
  }, [hash, id]);

  return (
    <details ref={ref} id={id} className="guide-topic">
      <summary className="guide-topic__summary">
        <span className="guide-topic__title">{topic.title}</span>
        <ChevronDown className="guide-topic__chevron" size={20} aria-hidden="true" />
      </summary>
      <div className="guide-topic__body">
        <ol className="guide-topic__steps">
          {topic.steps.map((step) => (
            <li key={step} className="guide-topic__step">{step}</li>
          ))}
        </ol>
        <Button variant="secondary" to={topic.goTo.to}>{topic.goTo.label}</Button>
      </div>
    </details>
  );
}

// The six how-tos at the end of the Guides group (Figma 319:1225 desktop, 320:928 phone).
export default function GuideTopics() {
  const { hash } = useLocation();
  return GUIDE_TOPICS.map((topic) => <GuideTopic key={topic.key} topic={topic} hash={hash} />);
}
