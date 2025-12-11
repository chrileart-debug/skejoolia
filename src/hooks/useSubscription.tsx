import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Plan {
  id: string;
  slug: string;
  name: string;
  price: number;
  max_agents: number;
  max_whatsapp: number;
  max_services: number | null;
  max_appointments_month: number | null;
  trial_days: number;
}

interface Subscription {
  id: string;
  user_id: string;
  plan_slug: string;
  status: "trialing" | "active" | "canceled" | "expired" | "past_due";
  price_at_signup: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  asaas_subscription_id: string | null;
}

interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  unlimited?: boolean;
  reason?: string;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  plan: Plan | null;
  plans: Plan[];
  isTrialing: boolean;
  isActive: boolean;
  daysRemaining: number;
  loading: boolean;
  checkLimit: (resource: "agents" | "whatsapp" | "services" | "appointments") => Promise<LimitCheckResult>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("is_active", true);

    if (!error && data) {
      setPlans(data as Plan[]);
    }
  };

  const fetchSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setPlan(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!error && data) {
      setSubscription(data as unknown as Subscription);
      
      // Fetch the plan details
      const { data: planData } = await supabase
        .from("plans")
        .select("*")
        .eq("slug", data.plan_slug)
        .single();

      if (planData) {
        setPlan(planData as Plan);
      }
    }

    setLoading(false);
  };

  const refreshSubscription = async () => {
    setLoading(true);
    await fetchSubscription();
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [user]);

  const isTrialing = subscription?.status === "trialing";
  const isActive = subscription?.status === "active" || isTrialing;

  const daysRemaining = (() => {
    if (!subscription?.trial_expires_at) return 0;
    const now = new Date();
    const expires = new Date(subscription.trial_expires_at);
    const diff = expires.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const checkLimit = async (resource: "agents" | "whatsapp" | "services" | "appointments"): Promise<LimitCheckResult> => {
    if (!user) {
      return { allowed: false, current: 0, limit: 0, reason: "not_authenticated" };
    }

    const { data, error } = await supabase.rpc("check_user_limit", {
      p_user_id: user.id,
      p_resource: resource,
    });

    if (error) {
      console.error("Error checking limit:", error);
      return { allowed: false, current: 0, limit: 0, reason: "error" };
    }

    const result = data as unknown as LimitCheckResult;
    return result;
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        plan,
        plans,
        isTrialing,
        isActive,
        daysRemaining,
        loading,
        checkLimit,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}
