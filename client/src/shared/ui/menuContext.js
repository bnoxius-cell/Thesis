import { createContext } from "react";

// What a MenuItem needs from the Menu around it: the role its rows take and how to close it.
export const MenuContext = createContext({ role: "menuitem", close: () => {} });
