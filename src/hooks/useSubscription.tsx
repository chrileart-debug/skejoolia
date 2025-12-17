import { useState, useEffect, createContext, useContext, ReactNode, useRef } from "react";
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
  const fallbackAttemptedRef = useRef(false);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("is_active", true);

    if (!error && data) {
      setPlans(data as Plan[]);
      return data as Plan[];
    }
    return [];
  };

  const createFallbackSubscription = async (userId: string, fetchedPlans: Plan[]) => {
    // Fallback subscription creation is now handled by the database trigger
    // This function is kept for backwards compatibility but should rarely be called
    console.log("Fallback subscription not needed - database trigger handles creation");
    return null;
  };

  const fetchSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setPlan(null);
      setLoading(false);
      fallbackAttemptedRef.current = false;
      return;
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code === "PGRST116") {
      // No subscription found - create fallback if not already attempted
      if (!fallbackAttemptedRef.current) {
        fallbackAttemptedRef.current = true;
        console.log("No subscription found, creating fallback...");
        
        // Fetch plans if not available
        let plansToUse = plans;
        if (plansToUse.length === 0) {
          const { data: fetchedPlans } = await supabase
            .from("plans")
            .select("*")
            .eq("is_active", true);
          
          if (fetchedPlans) {
            plansToUse = fetchedPlans as Plan[];
            setPlans(plansToUse);
          }
        }
        
        const fallbackData = await createFallbackSubscription(user.id, plansToUse);
        
        if (fallbackData) {
          setSubscription(fallbackData as unknown as Subscription);
          
          // Fetch the plan details
          const { data: planData } = await supabase
            .from("plans")
            .select("*")
            .eq("slug", fallbackData.plan_slug)
            .single();

          if (planData) {
            setPlan(planData as Plan);
          }
        }
      }
      setLoading(false);
      return;
    }

    if (!error && data) {
      let subscriptionData = data as unknown as Subscription;
      
      // Check if trial has expired and update status if needed
      if (subscriptionData.status === "trialing" && subscriptionData.trial_expires_at) {
        const trialExpires = new Date(subscriptionData.trial_expires_at);
        const now = new Date();
        
        if (trialExpires < now) {
          // Trial expired - update status to 'expired'
          console.log("Trial expired, updating status to expired...");
          const { data: updatedData, error: updateError } = await supabase
            .from("subscriptions")
            .update({ status: "expired", updated_at: new Date().toISOString() })
            .eq("id", subscriptionData.id)
            .select()
            .single();
          
          if (!updateError && updatedData) {
            subscriptionData = updatedData as unknown as Subscription;
          }
        }
      }
      
      setSubscription(subscriptionData);
      
      // Fetch the plan details
      const { data: planData } = await supabase
        .from("plans")
        .select("*")
        .eq("slug", subscriptionData.plan_slug)
        .single();

      if (planData) {
        setPlan(planData as Plan);
      }
    }

    setLoading(false);
  };

  const refreshSubscription = async () => {
    setLoading(true);
    fallbackAttemptedRef.current = false;
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
    const diffMs = expires.getTime() - now.getTime();
    // Use floor to get complete days remaining (7 days + 23h = 7, not 8)
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  })();

  const checkLimit = async (resource: "agents" | "whatsapp" | "services" | "appointments"): Promise<LimitCheckResult> => {
    if (!user) {
      return { allowed: false, current: 0, limit: 0, reason: "not_authenticated" };
    }

    // If no subscription exists yet, allow the action (fallback will create one)
    if (!subscription && !loading) {
      return { allowed: true, current: 0, limit: 1, reason: "no_subscription_yet" };
    }

    const { data, error } = await supabase.rpc("check_user_limit", {
      p_user_id: user.id,
      p_resource: resource,
    });

    if (error) {
      console.error("Error checking limit:", error);
      // On error, allow the action to prevent blocking users
      return { allowed: true, current: 0, limit: 0, reason: "error" };
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
