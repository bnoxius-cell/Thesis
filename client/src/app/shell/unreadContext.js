import { createContext, useContext } from "react";

const empty = { total: 0, groupsUnread: 0, friendRequests: 0, markGroupRead: () => {} };

// The counts behind the shell's badges. Outside the provider everything reads as zero.
export const UnreadContext = createContext(empty);

export const useUnread = () => useContext(UnreadContext);
