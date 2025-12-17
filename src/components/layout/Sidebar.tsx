import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Scissors,
  Calendar,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  Receipt,
  Crown,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useSubscription } from "@/hooks/useSubscription";

interface NavItem {
  title: string;
  icon: typeof LayoutDashboard;
  href: string;
  ownerOnly: boolean;
  corporateOnly?: boolean;
  permissionKey?: "can_view_dashboard" | "can_manage_agents" | "can_manage_schedule" | "can_view_clients";
}

// Navigation items with role and permission restrictions
const allNavItems: NavItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard", ownerOnly: false, permissionKey: "can_view_dashboard" },
  { title: "Agentes", icon: Bot, href: "/agents", ownerOnly: false, permissionKey: "can_manage_agents" },
  { title: "Integrações", icon: MessageSquare, href: "/integrations", ownerOnly: false, permissionKey: "can_manage_agents" },
  { title: "Serviços", icon: Scissors, href: "/services", ownerOnly: false },
  { title: "Agenda", icon: Calendar, href: "/schedule", ownerOnly: false, permissionKey: "can_manage_schedule" },
  { title: "Clientes", icon: Users, href: "/clients", ownerOnly: false, permissionKey: "can_view_clients" },
  { title: "Equipe", icon: UsersRound, href: "/team", ownerOnly: true, corporateOnly: true },
  { title: "Planos", icon: Crown, href: "/plans", ownerOnly: true },
  { title: "Faturas", icon: Receipt, href: "/billing", ownerOnly: true },
  { title: "Configurações", icon: Settings, href: "/settings", ownerOnly: true },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isOwner, permissions } = useBarbershop();
  const { subscription } = useSubscription();
  
  const isBasicPlan = subscription?.plan_slug === "basico";

  // Filter nav items based on role, permissions, and plan
  const navItems = allNavItems.filter(item => {
    // Owner-only items require owner role
    if (item.ownerOnly && !isOwner) return false;
    
    // Corporate-only items are hidden for basico plan
    if (item.corporateOnly && isBasicPlan) return false;
    
    // For staff, check granular permissions
    if (!isOwner && item.permissionKey) {
      return permissions[item.permissionKey];
    }
    
    return true;
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const handleNavClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed top-0 left-0 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out z-40",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center h-16 px-4 border-b border-sidebar-border",
          collapsed ? "justify-center" : "gap-3"
        )}>
          {collapsed ? (
            <span className="text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6v6l4 2"></path>
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
            </span>
          ) : (
            <div className="flex items-center font-extrabold tracking-tighter text-sidebar-foreground select-none text-2xl">
              <span>S</span>
              <span>K</span>
              <span>E</span>
              <span>J</span>
              <span className="text-primary inline-flex items-center justify-center mx-[2px] hover:rotate-180 transition-transform duration-700 ease-in-out">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 6v6l4 2"></path>
                  <circle cx="12" cy="12" r="10"></circle>
                </svg>
              </span>
              <span>O</span>
              <span>L</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-muted-foreground hover:text-destructive",
              collapsed && "justify-center px-2"
            )}
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span className="ml-3">Sair</span>}
          </Button>
        </div>

        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="absolute top-20 -right-3 w-6 h-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-accent transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out lg:hidden flex flex-col",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          <div className="flex items-center font-extrabold tracking-tighter text-sidebar-foreground select-none text-2xl">
            <span>S</span>
            <span>K</span>
            <span>E</span>
            <span>J</span>
            <span className="text-primary inline-flex items-center justify-center mx-[2px] hover:rotate-180 transition-transform duration-700 ease-in-out">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6v6l4 2"></path>
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
            </span>
            <span>O</span>
            <span>L</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onMobileClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Mobile Footer */}
        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            <span className="ml-3">Sair</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
