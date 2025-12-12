import { usePWA } from "@/hooks/usePWA";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone } from "lucide-react";

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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4 sm:p-5 animate-slide-up">
      {/* Dismiss button */}
      <button
        onClick={dismissBanner}
        className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-6">
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
    </div>
  );
}
