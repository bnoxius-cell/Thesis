import { toast } from "react-toastify";
import { Button } from "@/shared/ui";
import { useAuth } from "@/pages/authentication/AuthContext";
import "./people-shared.css";

// The student's own friend code with a Copy button (Figma 66:746 desktop; on a phone, 67:1017, it is
// one slim row above the list). A student with no code yet is told so, never given a made-up one.
export default function FriendCodeCard() {
  const code = useAuth().userData?.profileTag;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Friend code copied.");
    } catch {
      toast.error("Couldn't copy that. Select the code and copy it by hand.");
    }
  };

  return (
    <div className="people-card people-code">
      <div className="people-code__main">
        <p className="people-eyebrow">Your friend code</p>
        {code ? (
          <p className="people-code__value">{code}</p>
        ) : (
          <p className="people-code__hint">Your friend code isn't ready yet. Try again in a moment.</p>
        )}
      </div>
      {code && (
        <>
          <p className="people-code__hint">Share it with a classmate so they can add you.</p>
          <Button variant="secondary" className="people-code__copy" onClick={copy}>
            Copy<span className="people-code__long"> code</span>
          </Button>
        </>
      )}
    </div>
  );
}
