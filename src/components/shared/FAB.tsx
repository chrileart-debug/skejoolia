import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FABProps {
  onClick: () => void;
  icon?: React.ReactNode;
  label?: string;
  className?: string;
}

export function FAB({ onClick, icon, label, className }: FABProps) {
  return (
    <Button
      variant="fab"
      size={label ? "default" : "fab"}
      onClick={onClick}
      className={cn(
        "fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-40",
        label && "rounded-full px-5 h-12",
        className
      )}
    >
      {icon || <Plus className="w-6 h-6" />}
      {label && <span className="ml-2 font-semibold">{label}</span>}
    </Button>
  );
}
