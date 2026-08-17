import { supabase } from "@/lib/db/client";
import { fetchCompleteProfile } from "@/lib/session";
import { clearCurrentUserCache } from "@/lib/route-guards";
import type { RoleAccount, StudentProfile } from "@/lib/types";

export class AuthError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export function authMessage(error: unknown) {
  if (error instanceof AuthError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export const authApi = {
  async login(email: string, password: string): Promise<RoleAccount> {
    const trimmedEmail = email.trim().toLowerCase();

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      throw new AuthError("invalid_credentials", "Invalid email or password.");
    }

    if (!data.user) {
      throw new AuthError("invalid_credentials", "Failed to sign in. Please try again.");
    }

    // Fetch complete user profile from database in one fast step
    const account = await fetchCompleteProfile(data.user.id);

    if (!account) {
      throw new AuthError("user_not_found", "User profile not found. Please contact support.");
    }

    return account;
  },

  async register(payload: {
    name: string;
    email: string;
    password: string;
    phone: string;
    dob: string | null;
    board: string;
    standard: string;
    parentName: string;
    parentPhone: string;
  }): Promise<StudentProfile> {
    const trimmedEmail = payload.email.trim().toLowerCase();

    // Check if user already exists
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", trimmedEmail)
      .single();

    if (existing) {
      throw new AuthError("user_exists", "An account with this email already exists.");
    }

    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: payload.password,
    });

    if (authError) {
      throw new AuthError("signup_failed", authError.message || "Failed to create account.");
    }

    if (!authData.user) {
      throw new AuthError("signup_failed", "Failed to create account. Please try again.");
    }

    // Create user record in database
    const { data: userRecord, error: userError } = await supabase
      .from("users")
      .insert({
        id: authData.user.id,
        email: trimmedEmail,
        role: "student",
        name: payload.name,
        phone: payload.phone,
      })
      .select()
      .single();

    if (userError) {
      throw new AuthError("profile_creation_failed", "Failed to create user profile.");
    }

    // Create student profile
    const { error: studentError } = await supabase.from("students").insert({
      user_id: authData.user.id,
      board: payload.board,
      standard: payload.standard,
      dob: payload.dob,
      parent_name: payload.parentName,
      parent_phone: payload.parentPhone,
    });

    if (studentError) {
      throw new AuthError(
        "student_profile_failed",
        "Failed to create student profile. Please contact support.",
      );
    }

    // Explicitly sign out so next step starts from a clean login state
    await supabase.auth.signOut();
    clearCurrentUserCache();

    // Return student profile
    const studentProfile: StudentProfile = {
      id: userRecord.id,
      role: "student",
      email: userRecord.email,
      password: "",
      name: userRecord.name,
      phone: userRecord.phone || "",
      board: payload.board,
      standard: payload.standard,
      dob: payload.dob || new Date().toISOString(),
      subjectIds: [],
    };

    return studentProfile;
  },

  async logout(): Promise<void> {
    clearCurrentUserCache();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new AuthError("logout_failed", error.message || "Failed to sign out.");
    }
  },

  async resetPassword(email: string): Promise<void> {
    const redirectUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : "http://localhost:3000/reset-password";

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: redirectUrl,
    });

    if (error) {
      throw new AuthError("reset_failed", error.message || "Failed to send reset email.");
    }
  },
};
