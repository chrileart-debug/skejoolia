import { Moon, Sun, Link, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HamburgerMenuButton } from "./HamburgerMenuButton";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  showCopyLink?: boolean;
  barbershopSlug?: string | null;
}

function getInitials(name: string | null | undefined): string {
  if (!name || name.trim() === "") return "?";
  
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function Header({ title, subtitle, onMenuClick, showCopyLink, barbershopSlug }: HeaderProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [userName, setUserName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadUserName() {
      if (!user) return;
      
      const { data } = await supabase
        .from("user_settings")
        .select("nome")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data?.nome) {
        setUserName(data.nome);
      } else if (user.user_metadata?.nome) {
        setUserName(user.user_metadata.nome);
      }
    }
    
    loadUserName();
  }, [user]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const copyBookingLink = () => {
    if (!barbershopSlug) return;
    
    const link = `${window.location.origin}/a/${barbershopSlug}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link de agendamento copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const initials = getInitials(userName);

  return (
    <header className="bg-background/95 backdrop-blur-lg border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <HamburgerMenuButton isOpen={false} onClick={onMenuClick || (() => {})} />
          <div>
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Booking Link Button */}
          {showCopyLink && barbershopSlug && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyBookingLink}
              className="hidden sm:flex items-center gap-2"
            >
              {copied ? (
                <Check className="w-4 h-4 text-primary" />
              ) : (
                <Link className="w-4 h-4" />
              )}
              <span className="hidden md:inline">Copiar Link</span>
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </Button>
          <button
            onClick={() => navigate("/settings")}
            className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            {initials}
          </button>
        </div>
      </div>
    </header>
  );
}
