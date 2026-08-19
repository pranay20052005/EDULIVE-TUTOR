/**
 * Supabase Realtime Subscription Hooks
 * Provides reactive subscriptions to PostgreSQL database changes
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/db/client";

/**
 * Hook to subscribe to scheduled/live classes changes in real-time
 */
export function useLiveClassRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("scheduled-classes-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scheduled_classes",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["scheduled-classes"] });
          queryClient.invalidateQueries({ queryKey: ["scheduled-classes-by-subjects"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-classes"] });
          queryClient.invalidateQueries({ queryKey: ["scheduled-class"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * Hook to subscribe to user notifications in real-time
 */
export function useNotificationRealtime(userId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
          queryClient.invalidateQueries({ queryKey: ["unread-notifications-count", userId] });
          queryClient.invalidateQueries({ queryKey: ["user-notifications", userId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

/**
 * Hook to subscribe to recordings changes in real-time
 */
export function useRecordingRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("recordings-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recordings",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["recordings-published"] });
          queryClient.invalidateQueries({ queryKey: ["teacher-recordings"] });
          queryClient.invalidateQueries({ queryKey: ["recordings"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * Hook to subscribe to student recording watch progress in real-time
 */
export function useRecordingProgressRealtime(studentId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel(`recording-progress-${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_recording_progress",
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["recording-progress", studentId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, queryClient]);
}
