/**
 * Supabase Database Client
 * Central database connection and configuration
 */

import { createClient } from "@supabase/supabase-js";

// Validate environment variables
const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.",
  );
}

/**
 * Supabase client for browser-side operations
 * Uses anon key for limited permissions
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Get current session/auth state
 */
export async function getCurrentSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}

/**
 * Get user's role from database
 */
export async function getUserRole(userId: string) {
  const { data, error } = await supabase.from("users").select("role").eq("id", userId).single();

  if (error) {
    console.error("Error fetching user role:", error);
    return null;
  }

  return data?.role;
}

/**
 * Generic error handler for database operations
 */
export function handleDatabaseError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
}

/**
 * Check if user exists by email
 */
export async function userExists(email: string) {
  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("email", email.toLowerCase());

  if (error) {
    console.error("Error checking user existence:", error);
    return false;
  }

  return (count ?? 0) > 0;
}
