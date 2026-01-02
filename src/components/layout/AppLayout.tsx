import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { TrialBanner } from "@/components/subscription/TrialBanner";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { PageHeaderProvider, usePageHeader } from "@/contexts/PageHeaderContext";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useBarbershop } from "@/hooks/useBarbershop";
import { supabase } from "@/integrations/supabase/client";

interface Category {
  id: string;
  name: string;
  icon: string | null;
  display_order: number;
  is_active: boolean;
}

function AppLayoutContent() {
  const { user } = useAuth();
  const { 
    barbershop, 
    categories, 
    loading: barbershopLoading, 
    isOwner, 
    refreshBarbershop, 
    refreshCategories 
  } = useBarbershop();
  const { header } = usePageHeader();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);

  // Measure fixed header height and set CSS variable
  useLayoutEffect(() => {
    const updateHeaderHeight = () => {
      if (headerWrapperRef.current) {
        const height = headerWrapperRef.current.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--app-header-height', `${height}px`);
      }
    };

    updateHeaderHeight();

    const resizeObserver = new ResizeObserver(updateHeaderHeight);
    if (headerWrapperRef.current) {
      resizeObserver.observe(headerWrapperRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Check if onboarding is needed (barbershop has default name)
  useEffect(() => {
    if (!barbershopLoading && barbershop && user) {
      // Check if barbershop has default name
      if (barbershop.name === "Minha Barbearia") {
        // Fetch user phone from user_settings
        supabase
          .from("user_settings")
          .select("numero")
          .eq("user_id", user.id)
          .single()
          .then(({ data }) => {
            setUserPhone(data?.numero || null);
            setShowOnboarding(true);
          });
      }
    }
  }, [barbershop, barbershopLoading, user]);

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    refreshBarbershop();
  };

  // Show loading spinner while barbershop is loading to prevent white flash
  if (barbershopLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background w-full max-w-full">
      {/* Onboarding Modal */}
      {showOnboarding && barbershop && user && (
        <OnboardingModal
          isOpen={showOnboarding}
          barbershopId={barbershop.id}
          userId={user.id}
          currentPhone={userPhone}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={handleMobileMenuClose}
        />
      )}

      <div className="relative">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileMenuOpen}
          onMobileClose={handleMobileMenuClose}
        />
      </div>

      <div className={cn(
        "flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300",
        sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-64"
      )}>
        {/* Fixed header wrapper */}
        <div
          ref={headerWrapperRef}
          className={cn(
            "fixed top-0 right-0 z-40 bg-background/95 backdrop-blur-lg",
            sidebarCollapsed ? "lg:left-[72px]" : "lg:left-64",
            "left-0 transition-all duration-300"
          )}
        >
          <TrialBanner />
          <Header
            title={header.title}
            subtitle={header.subtitle}
            onMenuClick={handleMobileMenuToggle}
            showCopyLink={header.showCopyLink}
            barbershopSlug={barbershop?.slug}
          />
        </div>
        <main className="flex-1 pb-20 lg:pb-0 min-w-0 pt-[var(--app-header-height)]">
          <Outlet context={{ 
            onMenuClick: handleMobileMenuToggle, 
            barbershop,
            barbershopSlug: barbershop?.slug || null,
            isOwner,
            categories,
            refreshCategories,
          }} />
        </main>
      </div>

      <BottomNav />
    </div>
  );
}

export function AppLayout() {
  return (
    <PageHeaderProvider>
      <AppLayoutContent />
    </PageHeaderProvider>
  );
}
