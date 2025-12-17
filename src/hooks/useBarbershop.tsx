import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Barbershop {
  id: string;
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

export function useBarbershop() {
  const { user } = useAuth();
  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"owner" | "staff" | null>(null);

  useEffect(() => {
    if (user) {
      fetchBarbershopData();
    }
  }, [user]);

  const fetchBarbershopData = async () => {
    if (!user) return;

    try {
      // Get user's role and barbershop
      const { data: roleData, error: roleError } = await supabase
        .from("user_barbershop_roles")
        .select("barbershop_id, role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleError) throw roleError;

      if (roleData) {
        setRole(roleData.role as "owner" | "staff");

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

  return {
    barbershop,
    categories,
    loading,
    role,
    isOwner: role === "owner",
    refreshBarbershop: fetchBarbershopData,
    refreshCategories,
  };
}
