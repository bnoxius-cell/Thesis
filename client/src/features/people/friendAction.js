import { toast } from "react-toastify";

// Runs one friend change (accept, decline, add, remove...). On success a toast says what happened
// (`done` gets the server's answer and returns the line) and the answer comes back; on failure a
// toast carries the server's safe message and the result is null.
export async function runFriendAction(request, done) {
  const { data, error } = await request();
  if (error) {
    toast.error(error);
    return null;
  }
  toast.success(done(data));
  return data;
}

export const byName = (a, b) => a.name.localeCompare(b.name);
