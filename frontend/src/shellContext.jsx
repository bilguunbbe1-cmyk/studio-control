import { createContext, useContext } from "react";

export const ShellContext = createContext({
  user: null,
  openSearch: () => {},
  openNotifications: () => {},
  openNewProject: () => {},
});

export function useShellActions() {
  return useContext(ShellContext);
}
