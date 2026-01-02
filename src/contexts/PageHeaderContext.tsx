import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";

interface PageHeaderState {
  title: string;
  subtitle?: string;
  showCopyLink?: boolean;
}

interface PageHeaderContextValue {
  header: PageHeaderState;
  setHeader: (state: PageHeaderState) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<PageHeaderState>({ title: "" });

  const setHeader = useCallback((state: PageHeaderState) => {
    setHeaderState(state);
  }, []);

  return (
    <PageHeaderContext.Provider value={{ header, setHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  const context = useContext(PageHeaderContext);
  if (!context) {
    throw new Error("usePageHeader must be used within PageHeaderProvider");
  }
  return context;
}

/**
 * Hook to set the page header. Uses useEffect internally to update header on mount and when dependencies change.
 */
export function useSetPageHeader(title: string, subtitle?: string, showCopyLink?: boolean) {
  const { setHeader } = usePageHeader();
  
  useEffect(() => {
    setHeader({ title, subtitle, showCopyLink });
  }, [title, subtitle, showCopyLink, setHeader]);
}
