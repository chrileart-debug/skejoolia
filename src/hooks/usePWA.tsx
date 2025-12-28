import { useState, useEffect, useCallback } from "react";

const SESSION_DISMISSED_KEY = "pwa-banner-dismissed-session";

export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem(SESSION_DISMISSED_KEY) === "true";
  });

  // Detect mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  useEffect(() => {
    // Check if already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isIOSStandalone);
    };
    
    checkInstalled();
  }, []);

  const dismissBanner = useCallback(() => {
    setIsDismissed(true);
    sessionStorage.setItem(SESSION_DISMISSED_KEY, "true");
  }, []);

  // Show banner on mobile if not installed and not dismissed
  const shouldShowBanner = isMobile && !isInstalled && !isDismissed;

  return {
    isInstalled,
    isIOS,
    isAndroid,
    isMobile,
    isDismissed,
    shouldShowBanner,
    dismissBanner,
  };
}
