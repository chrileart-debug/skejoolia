import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  Scissors,
  Calendar,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBarbershop } from "@/hooks/useBarbershop";

interface NavItem {
  title: string;
  icon: typeof LayoutDashboard;
  href: string;
  permissionKey?: "can_view_dashboard" | "can_manage_agents" | "can_manage_schedule" | "can_view_clients";
}

const allNavItems: NavItem[] = [
  { title: "Home", icon: LayoutDashboard, href: "/dashboard", permissionKey: "can_view_dashboard" },
  { title: "Agenda", icon: Calendar, href: "/schedule", permissionKey: "can_manage_schedule" },
  { title: "Serviços", icon: Scissors, href: "/services" },
  { title: "Agentes", icon: Bot, href: "/agents", permissionKey: "can_manage_agents" },
  { title: "Ajuda", icon: HelpCircle, href: "/help" },
];

export function BottomNav() {
  const location = useLocation();
  const { isOwner, permissions } = useBarbershop();

  // Filter nav items based on permissions
  const navItems = allNavItems.filter(item => {
    // Owners have access to everything
    if (isOwner) return true;
    
    // For staff, check granular permissions
    if (item.permissionKey) {
      return permissions[item.permissionKey];
    }
    
    return true;
  });

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-pb overflow-hidden">
      <div className="flex items-center justify-around h-16 px-1 max-w-full">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl transition-all duration-200 flex-1 min-w-0",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-xl transition-all duration-200",
                  isActive && "bg-primary/10"
                )}
              >
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium">{item.title}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
