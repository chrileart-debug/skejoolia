import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VipBadgeProps {
  status: string;
  nextDueDate: string | null;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
}

/**
 * VipBadge - Displays Gold (active) or Red (expired) crown based on subscription status
 * 
 * Logic:
 * - Gold: status === 'active' AND next_due_date >= today
 * - Red: status === 'active' AND next_due_date < today (expired)
 */
export function VipBadge({ 
  status, 
  nextDueDate, 
  size = "sm", 
  showTooltip = true,
  className 
}: VipBadgeProps) {
  if (status !== "active") {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = nextDueDate ? new Date(nextDueDate) : null;
  if (dueDate) {
    dueDate.setHours(0, 0, 0, 0);
  }

  const isExpired = dueDate ? dueDate < today : false;
  
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const badgeSizeClasses = {
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-7 h-7",
  };

  const iconSizeClasses = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  const tooltipText = isExpired 
    ? `Assinatura vencida em ${dueDate?.toLocaleDateString("pt-BR")}`
    : dueDate
      ? `Assinatura VIP ativa até ${dueDate.toLocaleDateString("pt-BR")}`
      : "Assinatura VIP ativa";

  const badge = (
    <div
      className={cn(
        "rounded-full flex items-center justify-center shadow-sm",
        badgeSizeClasses[size],
        isExpired 
          ? "bg-red-500" 
          : "bg-amber-500",
        className
      )}
    >
      <Crown className={cn(
        "text-white",
        iconSizeClasses[size]
      )} />
    </div>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * VipCrown - Inline crown icon for names/titles
 */
export function VipCrown({ 
  status, 
  nextDueDate, 
  className 
}: {
  status: string;
  nextDueDate: string | null;
  className?: string;
}) {
  if (status !== "active") {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = nextDueDate ? new Date(nextDueDate) : null;
  if (dueDate) {
    dueDate.setHours(0, 0, 0, 0);
  }

  const isExpired = dueDate ? dueDate < today : false;

  return (
    <Crown className={cn(
      "w-4 h-4",
      isExpired ? "text-red-500" : "text-amber-500",
      className
    )} />
  );
}
