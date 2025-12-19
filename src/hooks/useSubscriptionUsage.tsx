import { supabase } from "@/integrations/supabase/client";

interface SubscriptionInfo {
  subscriptionId: string;
  planId: string;
  status: string;
}

interface UsageCheckResult {
  hasActiveSubscription: boolean;
  isServiceInPlan: boolean;
  currentUsage: number;
  quantityLimit: number;
  isWithinLimit: boolean;
  subscriptionId: string | null;
}

export function useSubscriptionUsage() {
  /**
   * Check if client has an active subscription
   */
  const getActiveSubscription = async (
    clientId: string,
    barbershopId: string
  ): Promise<SubscriptionInfo | null> => {
    const { data, error } = await supabase
      .from("client_club_subscriptions")
      .select("id, plan_id, status")
      .eq("client_id", clientId)
      .eq("barbershop_id", barbershopId)
      .eq("status", "active")
      .maybeSingle();

    if (error || !data) return null;

    return {
      subscriptionId: data.id,
      planId: data.plan_id,
      status: data.status,
    };
  };

  /**
   * Check if a service is part of the subscription plan and get its limit
   */
  const getServicePlanLimit = async (
    planId: string,
    serviceId: string
  ): Promise<{ isInPlan: boolean; quantityLimit: number }> => {
    const { data, error } = await supabase
      .from("barber_plan_items")
      .select("quantity_limit")
      .eq("plan_id", planId)
      .eq("service_id", serviceId)
      .maybeSingle();

    if (error || !data) {
      return { isInPlan: false, quantityLimit: 0 };
    }

    return {
      isInPlan: true,
      quantityLimit: data.quantity_limit || 0,
    };
  };

  /**
   * Count current month usage for a subscription and service
   */
  const getCurrentMonthUsage = async (
    subscriptionId: string,
    serviceId: string
  ): Promise<number> => {
    // Get the first and last day of the current month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const { count, error } = await supabase
      .from("client_subscription_usage")
      .select("*", { count: "exact", head: true })
      .eq("subscription_id", subscriptionId)
      .eq("service_id", serviceId)
      .gte("used_at", firstDayOfMonth.toISOString())
      .lte("used_at", lastDayOfMonth.toISOString());

    if (error) {
      console.error("Error counting usage:", error);
      return 0;
    }

    return count || 0;
  };

  /**
   * Full check: subscription status, service in plan, usage vs limit
   */
  const checkSubscriptionUsage = async (
    clientId: string,
    barbershopId: string,
    serviceId: string
  ): Promise<UsageCheckResult> => {
    // Default result
    const defaultResult: UsageCheckResult = {
      hasActiveSubscription: false,
      isServiceInPlan: false,
      currentUsage: 0,
      quantityLimit: 0,
      isWithinLimit: true,
      subscriptionId: null,
    };

    // Step B: Check for active subscription
    const subscription = await getActiveSubscription(clientId, barbershopId);
    if (!subscription) {
      return defaultResult;
    }

    // Step C & D: Check if service is in plan and get limit
    const { isInPlan, quantityLimit } = await getServicePlanLimit(
      subscription.planId,
      serviceId
    );

    if (!isInPlan) {
      return {
        ...defaultResult,
        hasActiveSubscription: true,
        subscriptionId: subscription.subscriptionId,
      };
    }

    // Count current month usage
    const currentUsage = await getCurrentMonthUsage(
      subscription.subscriptionId,
      serviceId
    );

    // If quantityLimit is 0, it means unlimited
    const isWithinLimit = quantityLimit === 0 || currentUsage < quantityLimit;

    return {
      hasActiveSubscription: true,
      isServiceInPlan: true,
      currentUsage,
      quantityLimit,
      isWithinLimit,
      subscriptionId: subscription.subscriptionId,
    };
  };

  /**
   * Record usage after appointment is created
   */
  const recordUsage = async (
    subscriptionId: string,
    serviceId: string,
    appointmentId: string
  ): Promise<boolean> => {
    const { error } = await supabase.from("client_subscription_usage").insert({
      subscription_id: subscriptionId,
      service_id: serviceId,
      appointment_id: appointmentId,
    });

    if (error) {
      console.error("Error recording usage:", error);
      return false;
    }

    return true;
  };

  return {
    checkSubscriptionUsage,
    recordUsage,
  };
}
