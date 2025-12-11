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

  const ensureUserSettings = async (userId: string, userEmail: string | undefined) => {
    // Check if user_settings exists
    const { data: existingSettings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingSettings) {
      // Create user_settings if it doesn't exist
      await supabase
        .from("user_settings")
        .insert({
          user_id: userId,
          email: userEmail,
        });
    }
  };

  const createFallbackSubscription = async (userId: string, fetchedPlans: Plan[]) => {
    // Get the basic plan (default)
    const basicPlan = fetchedPlans.find(p => p.slug === "basico") || fetchedPlans[0];
    
    if (!basicPlan) {
      console.error("No plans available for fallback subscription");
      return null;
    }

    // Calculate trial expiration (7 days from now)
    const trialExpiresAt = new Date();
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 7);

    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan_slug: basicPlan.slug,
        status: "trialing",
        price_at_signup: basicPlan.price,
        trial_started_at: new Date().toISOString(),
        trial_expires_at: trialExpiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating fallback subscription:", error);
      return null;
    }

    console.log("Fallback subscription created successfully:", data);
    return data;
  };

  const fetchSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setPlan(null);
      setLoading(false);
      fallbackAttemptedRef.current = false;
      return;
    }

    // Ensure user_settings exists
    await ensureUserSettings(user.id, user.email);

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
    const diff = expires.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
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
