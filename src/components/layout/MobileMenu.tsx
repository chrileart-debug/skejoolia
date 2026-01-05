import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Scissors,
  Calendar,
  Users,
  Settings,
  LogOut,
  Receipt,
  Crown,
  UsersRound,
  Sparkles,
  HelpCircle,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useSubscription } from "@/hooks/useSubscription";

interface NavItem {
  title: string;
  icon: typeof LayoutDashboard;
  href: string;
  ownerOnly: boolean;
  corporativoOnly?: boolean;
  permissionKey?: "can_view_dashboard" | "can_manage_agents" | "can_manage_schedule" | "can_view_clients";
}

const allNavItems: NavItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard", ownerOnly: false, permissionKey: "can_view_dashboard" },
  { title: "Agentes", icon: Bot, href: "/agents", ownerOnly: false, permissionKey: "can_manage_agents" },
  { title: "Integrações", icon: MessageSquare, href: "/integrations", ownerOnly: false, permissionKey: "can_manage_agents" },
  { title: "Serviços", icon: Scissors, href: "/services", ownerOnly: false },
  { title: "Agenda", icon: Calendar, href: "/schedule", ownerOnly: false, permissionKey: "can_manage_schedule" },
  { title: "Clientes", icon: Users, href: "/clients", ownerOnly: false, permissionKey: "can_view_clients" },
  { title: "Comissões", icon: Wallet, href: "/commissions", ownerOnly: false, corporativoOnly: true },
  { title: "Equipe", icon: UsersRound, href: "/team", ownerOnly: true, corporativoOnly: true },
  { title: "Meu Clube", icon: Sparkles, href: "/club", ownerOnly: true },
  { title: "Planos", icon: Crown, href: "/plans", ownerOnly: true },
  { title: "Faturas", icon: Receipt, href: "/billing", ownerOnly: true },
  { title: "Configurações", icon: Settings, href: "/settings", ownerOnly: true },
];

interface MobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMenu({ open, onOpenChange }: MobileMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isOwner, permissions } = useBarbershop();
  const { subscription } = useSubscription();

  // Check if user is on basico plan
  const isBasicoPlan = subscription?.plan_slug === "basico";

  // Filter nav items based on role, permissions, and plan
  const navItems = allNavItems.filter(item => {
    if (item.ownerOnly && !isOwner) return false;
    if (item.corporativoOnly && isBasicoPlan) return false;
    if (!isOwner && item.permissionKey) {
      return permissions[item.permissionKey];
    }
    return true;
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/");
    onOpenChange(false);
  };

  const handleNavClick = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="left" 
        className="w-[280px] p-0 flex flex-col bg-sidebar border-sidebar-border"
        style={{ height: "100dvh" }}
      >
        {/* Header with Logo */}
        <SheetHeader className="p-4 border-b border-sidebar-border">
          <SheetTitle className="flex items-center font-extrabold tracking-tighter text-sidebar-foreground select-none text-2xl">
            <span>S</span>
            <span>K</span>
            <span>E</span>
            <span>J</span>
            <span className="text-primary inline-flex items-center justify-center mx-[2px]">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6v6l4 2"></path>
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
            </span>
            <span>O</span>
            <span>L</span>
          </SheetTitle>
        </SheetHeader>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                  "animate-fade-in",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent active:scale-[0.98]"
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
                <span className="text-sm">{item.title}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-sidebar-border space-y-1 pb-safe">
          <NavLink
            to="/help"
            onClick={handleNavClick}
            className={cn(
              "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 w-full",
              location.pathname === "/help"
                ? "bg-primary/10 text-primary font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent active:scale-[0.98]"
            )}
          >
            <HelpCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">Ajuda</span>
          </NavLink>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 py-3 h-auto active:scale-[0.98] transition-all duration-200"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            <span className="ml-3 text-sm">Sair</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
