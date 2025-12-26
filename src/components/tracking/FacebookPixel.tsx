import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}

export function FacebookPixel() {
  const location = useLocation();

  useEffect(() => {
    // Dispara PageView a cada mudança de rota
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "PageView");
      console.log("[FB Pixel] PageView tracked on route:", location.pathname);
    }
  }, [location.pathname]);

  // Componente não renderiza nada visualmente
  return null;
}
