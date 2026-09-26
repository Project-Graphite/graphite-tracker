import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Attribution } from './catalog';

export interface FooterSource extends Attribution {
  links?: Array<{ label: string; url: string }>;
}

const FooterSourceContext = createContext<{
  source: FooterSource | null;
  setSource: (source: FooterSource | null) => void;
}>({ source: null, setSource: () => {} });

export function FooterSourceProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<FooterSource | null>(null);
  return (
    <FooterSourceContext.Provider value={{ source, setSource }}>{children}</FooterSourceContext.Provider>
  );
}

export function useFooterSource(source: FooterSource | undefined) {
  const { setSource } = useContext(FooterSourceContext);
  const serialized = source && JSON.stringify(source);
  useEffect(() => {
    if (!serialized) return;
    setSource(JSON.parse(serialized) as FooterSource);
    return () => setSource(null);
  }, [serialized, setSource]);
}

export function useCurrentFooterSource() {
  return useContext(FooterSourceContext).source;
}
