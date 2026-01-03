import { cn } from "@/lib/utils";

interface HamburgerMenuButtonProps {
  isOpen: boolean;
  onClick: () => void;
  className?: string;
}

export function HamburgerMenuButton({ isOpen, onClick, className }: HamburgerMenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "lg:hidden relative w-10 h-10 rounded-lg flex items-center justify-center",
        "hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "transition-colors duration-200",
        className
      )}
      aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
      aria-expanded={isOpen}
    >
      <div className="w-5 h-4 relative flex flex-col justify-between">
        {/* Top bar */}
        <span
          className={cn(
            "absolute left-0 w-5 h-0.5 bg-foreground rounded-full transition-all duration-300 ease-out origin-center",
            isOpen 
              ? "top-1/2 -translate-y-1/2 rotate-45" 
              : "top-0"
          )}
        />
        {/* Middle bar */}
        <span
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 w-5 h-0.5 bg-foreground rounded-full transition-all duration-200 ease-out",
            isOpen 
              ? "opacity-0 scale-x-0" 
              : "opacity-100 scale-x-100"
          )}
        />
        {/* Bottom bar */}
        <span
          className={cn(
            "absolute left-0 w-5 h-0.5 bg-foreground rounded-full transition-all duration-300 ease-out origin-center",
            isOpen 
              ? "top-1/2 -translate-y-1/2 -rotate-45" 
              : "bottom-0"
          )}
        />
      </div>
    </button>
  );
}
