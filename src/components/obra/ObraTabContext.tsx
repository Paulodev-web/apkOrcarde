import type { ReactElement, ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type ObraTabKey =
  | 'dashboard'
  | 'diario'
  | 'marcos'
  | 'postes'
  | 'checklists'
  | 'alertas'
  | 'equipe';

const ORDER: ObraTabKey[] = [
  'dashboard',
  'diario',
  'marcos',
  'postes',
  'checklists',
  'alertas',
  'equipe',
];

type Ctx = {
  tabIndex: number;
  setTabIndex: (i: number) => void;
  jumpToTab: (key: ObraTabKey) => void;
};

const ObraTabContext = createContext<Ctx | null>(null);

export function ObraTabProvider({ children }: { children: ReactNode }): ReactElement {
  const [tabIndex, setTabIndex] = useState(0);

  const jumpToTab = useCallback((key: ObraTabKey) => {
    const i = ORDER.indexOf(key);
    if (i >= 0) setTabIndex(i);
  }, []);

  const value = useMemo(() => ({ tabIndex, setTabIndex, jumpToTab }), [tabIndex, jumpToTab]);

  return <ObraTabContext.Provider value={value}>{children}</ObraTabContext.Provider>;
}

export function useObraTabs(): Ctx {
  const ctx = useContext(ObraTabContext);
  if (!ctx) throw new Error('useObraTabs must be used within ObraTabProvider');
  return ctx;
}
