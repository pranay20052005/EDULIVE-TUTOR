/**
 * Notifications Database Service
 * Handles notification-related database operations
 */

import { supabase, handleDatabaseError } from "@/lib/db/client";
import type { NotificationItem } from "@/lib/db/types";

export const notificationService = {
  /**
   * Fetch a notification by ID
   */
  async getById(id: string): Promise<NotificationItem | null> {
    const { data, error } = await supabase
      .from("notifications")
      .select("*, user:users(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching notification:", error);
      return null;
    }

    return data;
  },

  /**
   * List notifications for a user
   */
  async listByUser(userId: string, filter?: { unread?: boolean }): Promise<NotificationItem[]> {
    let query = supabase.from("notifications").select("*, user:users(*)").eq("user_id", userId);

    if (filter?.unread) {
      query = query.eq("read", false);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing notifications for user:", error);
      return [];
    }

    return data;
  },

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }

    return count || 0;
  },

  /**
   * Create a notification
   */
  async create(input: {
    user_id: string;
    type: "class" | "content" | "test" | "billing" | "general";
    title: string;
    message: string;
    related_entity_id?: string;
    related_entity_type?: string;
  }): Promise<NotificationItem> {
    const { data, error } = await supabase
      .from("notifications")
      .insert([input])
      .select("*, user:users(*)")
      .single();

    if (error) {
      throw new Error(`Failed to create notification: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<NotificationItem> {
    const { data, error } = await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, user:users(*)")
      .single();

    if (error) {
      throw new Error(`Failed to mark notification as read: ${handleDatabaseError(error)}`);
    }

    return data;
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("read", false);

    if (error) {
      throw new Error(`Failed to mark all notifications as read: ${handleDatabaseError(error)}`);
    }
  },

  /**
   * Delete a notification
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("notifications").delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete notification: ${handleDatabaseError(error)}`);
    }
  },
};
