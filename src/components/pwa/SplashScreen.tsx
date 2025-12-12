import { Clock } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      onAnimationEnd={onComplete}
    >
      {/* Animated clock icon */}
      <div className="relative animate-splash-icon">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-splash-pulse" />
        <Clock className="w-20 h-20 text-primary animate-splash-spin" strokeWidth={2} />
      </div>

      {/* Brand text */}
      <div className="mt-8 animate-splash-text">
        <span className="text-3xl font-bold tracking-tight text-foreground">
          SK
        </span>
        <span className="text-3xl font-bold tracking-tight text-primary">
          E
        </span>
        <span className="text-3xl font-bold tracking-tight text-foreground">
          JOOL
        </span>
      </div>

      {/* Tagline */}
      <p className="mt-2 text-sm text-muted-foreground animate-splash-text-delayed">
        Gestão Inteligente com IA
      </p>
    </div>
  );
}
