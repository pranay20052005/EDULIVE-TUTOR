/**
 * Subscription Plans Database Service
 * Handles subscription plan-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { SubscriptionPlan } from "@/lib/db/types";

export const subscriptionPlanService = {
  /**
   * Fetch a subscription plan by ID
   */
  async getById(id: string): Promise<SubscriptionPlan | null> {
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching subscription plan:", error);
      return null;
    }

    return data;
  },

  /**
   * Get a subscription plan by name
   */
  async getByName(name: string): Promise<SubscriptionPlan | null> {
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("name", name)
      .single();

    if (error) {
      console.error("Error fetching subscription plan by name:", error);
      return null;
    }

    return data;
  },

  /**
   * List all active subscription plans
   */
  async listActive(): Promise<SubscriptionPlan[]> {
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("active", true)
      .order("price_inr", { ascending: true });

    if (error) {
      console.error("Error listing active subscription plans:", error);
      return [];
    }

    return data;
  },

  /**
   * List all subscription plans
   */
  async listAll(): Promise<SubscriptionPlan[]> {
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("price_inr", { ascending: true });

    if (error) {
      console.error("Error listing subscription plans:", error);
      return [];
    }

    return data;
  },

  /**
   * Create a subscription plan
   */
  async create(input: {
    name: string;
    description?: string;
    price_inr: number;
    features?: string[];
    duration_days: number;
    plan_kind: "monthly" | "quarterly" | "annual";
    active?: boolean;
  }): Promise<SubscriptionPlan> {
    const { data, error } = await supabase
      .from("subscription_plans")
      .insert([
        {
          ...input,
          active: input.active !== false,
        },
      ])
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create subscription plan: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Update a subscription plan
   */
  async update(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      price_inr: number;
      features: string[];
      duration_days: number;
      plan_kind: "monthly" | "quarterly" | "annual";
      active: boolean;
    }>,
  ): Promise<SubscriptionPlan> {
    const { data, error } = await supabase
      .from("subscription_plans")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update subscription plan: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Deactivate a subscription plan
   */
  async deactivate(id: string): Promise<SubscriptionPlan> {
    const { data, error } = await supabase
      .from("subscription_plans")
      .update({ active: false })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to deactivate subscription plan: ${handleDatabaseError(error)}`);
    }

    return data;
  },
};
