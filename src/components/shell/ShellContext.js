import { createContext, useContext } from 'react';

/** Shell-wide controls: the Manami panel, the command palette and the mobile sidebar. */
export const ShellContext = createContext({
  meta: { section: '', screen: '', crumbs: [] },
  manamiOpen: false,
  openManami: () => {},
  closeManami: () => {},
  openPalette: () => {},
  hasTip: false,
});

export const useShell = () => useContext(ShellContext);
