import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { IconButton, Menu, MenuItem } from "@/shared/ui";
import DeleteReviewerDialog from "./DeleteReviewerDialog";

// The More menu in the page header: Delete, then back to the Reviewers tab. Rename, New questions
// and Targeted review have no drawn dialogs yet, so they aren't here.
export default function ReviewerMoreMenu({ reviewer }) {
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const deleted = () => {
    toast.success("Reviewer deleted.");
    navigate("/study?tab=reviewers", { replace: true });
  };

  return (
    <>
      <Menu
        align="end"
        label={`Actions for ${reviewer.title}`}
        trigger={(props) => <IconButton plain icon={MoreHorizontal} label="More for this reviewer" {...props} />}
      >
        <MenuItem icon={Trash2} tone="danger" onSelect={() => setDeleting(true)}>Delete</MenuItem>
      </Menu>
      {deleting && <DeleteReviewerDialog reviewer={reviewer} onClose={() => setDeleting(false)} onDeleted={deleted} />}
    </>
  );
}
