import { createContext, useContext } from "react";

const noop = () => {};

// The global add: open(kind) shows the dialog for "task", "class", "exam", "event", "activity", "subject" or
// "reviewer"; close() hides it; register(context) is how the open page says what it holds (see useAddHere)
// and answers a function that takes it back. Outside the provider the calls do nothing.
export const AddContext = createContext({ open: noop, close: noop, register: () => noop });

export const useGlobalAdd = () => useContext(AddContext);
