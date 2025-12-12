import { usePWA } from "@/hooks/usePWA";
import { Button } from "@/components/ui/button";
import { Download, Smartphone } from "lucide-react";

export function InstallBanner() {
  const { 
    isInstallable, 
    isIOS, 
    shouldShowBanner, 
    promptInstall, 
    dismissBanner 
  } = usePWA();

  // Don't show if conditions not met
  if (!shouldShowBanner) return null;

  const handleInstall = async () => {
    if (isInstallable) {
      // Android with native prompt available
      await promptInstall();
    } else {
      // iOS or Android without prompt - go to install page
      window.location.href = "/instalar";
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4 sm:p-5 animate-slide-up">
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm sm:text-base">
            Instale o Skejool
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
            {isIOS 
              ? "Toque em Compartilhar e depois 'Adicionar à Tela Inicial'"
              : "Acesso rápido direto da sua tela inicial"
            }
          </p>
        </div>

        {/* Install button */}
        <Button
          onClick={handleInstall}
          size="sm"
          className="shrink-0 gap-2"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Instalar</span>
        </Button>
      </div>

      {/* Discrete dismiss link */}
      <button
        onClick={dismissBanner}
        className="w-full mt-3 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
      >
        Agora não
      </button>
    </div>
  );
}
