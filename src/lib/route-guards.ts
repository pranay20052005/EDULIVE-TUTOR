/**
 * Route guards and middleware for authentication and authorization
 */

import { redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/db/client";
import type { Role } from "@/lib/types";

interface CachedUserRecord {
  id: string;
  email: string;
  role: Role;
  name: string;
  phone: string;
  fetchedAt: number;
}

let cachedUser: CachedUserRecord | null = null;
const CACHE_TTL_MS = 15000; // 15s memory cache for smooth navigation

/**
 * Clear cached user (e.g. on sign out or login)
 */
export function clearCurrentUserCache() {
  cachedUser = null;
}

/**
 * Update cached user profile directly
 */
export function setCurrentUserCache(user: {
  id: string;
  email: string;
  role: Role;
  name: string;
  phone?: string;
}) {
  cachedUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    phone: user.phone || "",
    fetchedAt: Date.now(),
  };
}

/**
 * Check if the active session belongs to an unverified email user
 */
export async function getUnverifiedEmail(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return null;
  }

  const isEmailProvider =
    session.user.app_metadata?.provider === "email" || !session.user.app_metadata?.provider;
  const isVerified = Boolean(session.user.email_confirmed_at || session.user.confirmed_at);

  if (isEmailProvider && !isVerified) {
    return session.user.email || "";
  }

  return null;
}

/**
 * Get current authenticated user and their role with smart caching
 * Only returns verified users.
 */
export async function getCurrentUserWithRole() {
  if (typeof window === "undefined") {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    cachedUser = null;
    return null;
  }

  // Reject unverified email/password users
  const isEmailProvider =
    session.user.app_metadata?.provider === "email" || !session.user.app_metadata?.provider;
  const isVerified = Boolean(session.user.email_confirmed_at || session.user.confirmed_at);

  if (isEmailProvider && !isVerified) {
    cachedUser = null;
    return null;
  }

  // If cached user matches current session and is fresh, return immediately
  if (
    cachedUser &&
    cachedUser.id === session.user.id &&
    Date.now() - cachedUser.fetchedAt < CACHE_TTL_MS
  ) {
    return {
      id: cachedUser.id,
      email: cachedUser.email,
      role: cachedUser.role,
      name: cachedUser.name,
      phone: cachedUser.phone,
    };
  }

  let { data: userRecord } = await supabase
    .from("users")
    .select("id, email, role, name, phone")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!userRecord && session.user.email) {
    const { data: byEmail } = await supabase
      .from("users")
      .select("id, email, role, name, phone")
      .eq("email", session.user.email.toLowerCase())
      .maybeSingle();
    if (byEmail) {
      userRecord = byEmail;
    }
  }

  if (!userRecord) {
    cachedUser = null;
    return null;
  }

  const result = {
    id: userRecord.id,
    email: userRecord.email,
    role: userRecord.role as Role,
    name: userRecord.name,
    phone: userRecord.phone || "",
  };

  cachedUser = {
    ...result,
    fetchedAt: Date.now(),
  };

  return result;
}

/**
 * Protect routes - redirect to login or verify-email if not authenticated / unverified
 */
export async function protectedRouteLoader() {
  if (typeof window === "undefined") return null;

  const unverifiedEmail = await getUnverifiedEmail();
  if (unverifiedEmail) {
    throw redirect({
      to: "/verify-email",
      search: { email: unverifiedEmail },
    });
  }

  const user = await getCurrentUserWithRole();
  if (!user) {
    throw redirect({
      to: "/login",
      search: { redirect: typeof window !== "undefined" ? window.location.pathname : undefined },
    });
  }
  return user;
}

/**
 * Protect student routes - ensure user is a verified student
 */
export async function studentRouteLoader() {
  if (typeof window === "undefined") return null;

  const unverifiedEmail = await getUnverifiedEmail();
  if (unverifiedEmail) {
    throw redirect({
      to: "/verify-email",
      search: { email: unverifiedEmail },
    });
  }

  const user = await getCurrentUserWithRole();
  if (!user) {
    throw redirect({
      to: "/login",
      search: { redirect: typeof window !== "undefined" ? window.location.pathname : undefined },
    });
  }
  if (user.role !== "student") {
    throw redirect({
      to: getHomeForRole(user.role),
    });
  }
  return user;
}

/**
 * Protect teacher routes - ensure user is a verified teacher
 */
export async function teacherRouteLoader() {
  if (typeof window === "undefined") return null;

  const unverifiedEmail = await getUnverifiedEmail();
  if (unverifiedEmail) {
    throw redirect({
      to: "/verify-email",
      search: { email: unverifiedEmail },
    });
  }

  const user = await getCurrentUserWithRole();
  if (!user) {
    throw redirect({
      to: "/login",
      search: { redirect: typeof window !== "undefined" ? window.location.pathname : undefined },
    });
  }
  if (user.role !== "teacher") {
    throw redirect({
      to: getHomeForRole(user.role),
    });
  }
  return user;
}

/**
 * Protect admin routes - ensure user is a verified admin
 */
export async function adminRouteLoader() {
  if (typeof window === "undefined") return null;

  const unverifiedEmail = await getUnverifiedEmail();
  if (unverifiedEmail) {
    throw redirect({
      to: "/verify-email",
      search: { email: unverifiedEmail },
    });
  }

  const user = await getCurrentUserWithRole();
  if (!user) {
    throw redirect({
      to: "/login",
      search: { redirect: typeof window !== "undefined" ? window.location.pathname : undefined },
    });
  }
  if (user.role !== "admin") {
    throw redirect({
      to: getHomeForRole(user.role),
    });
  }
  return user;
}

/**
 * Public route loader - if authenticated, redirect to role home
 */
export async function publicRouteLoader() {
  if (typeof window === "undefined") return null;
  const user = await getCurrentUserWithRole();
  if (user) {
    throw redirect({
      to: getHomeForRole(user.role),
    });
  }
  return null;
}

/**
 * Get home path for a role
 */
export function getHomeForRole(role: Role): string {
  switch (role) {
    case "student":
      return "/app";
    case "teacher":
      return "/teacher";
    case "admin":
      return "/admin";
    default:
      return "/";
  }
}
