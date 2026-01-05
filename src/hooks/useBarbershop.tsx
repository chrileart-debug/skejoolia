import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Barbershop {
  id: string;
  owner_id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  display_order: number;
  is_active: boolean;
}

export interface Permissions {
  can_view_dashboard: boolean;
  can_manage_agents: boolean;
  can_manage_schedule: boolean;
  can_view_clients: boolean;
  can_manage_services: boolean;
}

const DEFAULT_PERMISSIONS: Permissions = {
  can_view_dashboard: false,
  can_manage_agents: false,
  can_manage_schedule: true,
  can_view_clients: true,
  can_manage_services: false,
};

const OWNER_PERMISSIONS: Permissions = {
  can_view_dashboard: true,
  can_manage_agents: true,
  can_manage_schedule: true,
  can_view_clients: true,
  can_manage_services: true,
};

export function useBarbershop() {
  const { user } = useAuth();
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"owner" | "staff" | null>(null);
  const [permissions, setPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);

  useEffect(() => {
    if (user) {
      fetchBarbershopData();
    }
  }, [user]);

  const fetchBarbershopData = async () => {
    if (!user) return;

    try {
      // Get user's role, permissions and barbershop
      const { data: roleData, error: roleError } = await supabase
        .from("user_barbershop_roles")
        .select("barbershop_id, role, permissions")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleError) throw roleError;

      if (roleData) {
        const userRole = roleData.role as "owner" | "staff";
        setRole(userRole);

        // Set permissions - owners always have full permissions
        if (userRole === "owner") {
          setPermissions(OWNER_PERMISSIONS);
        } else {
          const dbPermissions = roleData.permissions as unknown as Permissions | null;
          setPermissions(dbPermissions || DEFAULT_PERMISSIONS);
        }

        // Get barbershop details
        const { data: shopData, error: shopError } = await supabase
          .from("barbershops")
          .select("*")
          .eq("id", roleData.barbershop_id)
          .single();

        if (shopError) throw shopError;

        setBarbershop(shopData);

        // Get categories
        const { data: catData } = await supabase
          .from("categories")
          .select("*")
          .eq("barbershop_id", roleData.barbershop_id)
          .order("display_order", { ascending: true });

        setCategories(catData || []);
      }
    } catch (error) {
      console.error("Error fetching barbershop:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshCategories = async () => {
    if (!barbershop) return;

    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .order("display_order", { ascending: true });

    setCategories(data || []);
  };

  // Helper functions for permission checks
  const canViewDashboard = role === "owner" || permissions.can_view_dashboard;
  const canManageAgents = role === "owner" || permissions.can_manage_agents;
  const canManageSchedule = role === "owner" || permissions.can_manage_schedule;
  const canViewClients = role === "owner" || permissions.can_view_clients;
  const canManageServices = role === "owner" || permissions.can_manage_services;

  return {
    barbershop,
    categories,
    loading,
    role,
    permissions,
    isOwner: role === "owner",
    canViewDashboard,
    canManageAgents,
    canManageSchedule,
    canViewClients,
    canManageServices,
    refreshBarbershop: fetchBarbershopData,
    refreshCategories,
  };
}
