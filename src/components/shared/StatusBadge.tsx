import { cn } from "@/lib/utils";

type Status = "online" | "offline" | "pending" | "confirmed" | "completed" | "cancelled";

interface StatusBadgeProps {
  status: Status;
  showDot?: boolean;
  className?: string;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  online: {
    label: "Online",
    className: "bg-success/10 text-success border-success/20",
  },
  offline: {
    label: "Offline",
    className: "bg-muted text-muted-foreground border-border",
  },
  pending: {
    label: "Pendente",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  confirmed: {
    label: "Confirmado",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  completed: {
    label: "Concluído",
    className: "bg-success/10 text-success border-success/20",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function StatusBadge({ status, showDot = true, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        config.className,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            status === "online" && "bg-success animate-pulse-soft",
            status === "offline" && "bg-muted-foreground",
            status === "pending" && "bg-warning",
            status === "confirmed" && "bg-primary",
            status === "completed" && "bg-success",
            !statusConfig[status] && "bg-warning"
          )}
        />
      )}
      {config.label}
    </span>
  );
}
