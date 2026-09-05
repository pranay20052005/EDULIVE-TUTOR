import { supabase } from "@/lib/db/client";
import { fetchCompleteProfile } from "@/lib/session";
import { clearCurrentUserCache } from "@/lib/route-guards";
import type { Role, RoleAccount } from "@/lib/types";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";

export class AuthError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export function authMessage(error: unknown): string {
  if (process.env.NODE_ENV !== "production") {
    console.error("[EduLive API/Auth Error]:", error);
  }

  let raw = "";
  if (error instanceof AuthError) {
    raw = error.message;
  } else if (error instanceof Error) {
    raw = error.message;
  } else if (typeof error === "string") {
    raw = error;
  } else if (error && typeof error === "object" && "message" in error) {
    raw = String((error as any).message);
  } else {
    return "Something went wrong. Please try again.";
  }

  const lower = raw.toLowerCase();

  // Map known technical error patterns to friendly user feedback
  if (lower.includes("invalid_credentials") || lower.includes("invalid login credentials")) {
    return "Invalid email or password. Please check your credentials and try again.";
  }
  if (lower.includes("email not confirmed") || lower.includes("unverified")) {
    return "Please verify your email address before signing in. Check your inbox for the OTP verification code.";
  }
  if (
    lower.includes("users_email_key") ||
    lower.includes("user already registered") ||
    lower.includes("already exists")
  ) {
    return "An account with this email address already exists. Please sign in instead.";
  }
  if (
    lower.includes("otp_expired") ||
    lower.includes("token has expired") ||
    lower.includes("token is expired")
  ) {
    return "The verification code has expired. Please request a new code.";
  }
  if (
    lower.includes("invalid token") ||
    lower.includes("token is invalid") ||
    lower.includes("invalid otp")
  ) {
    return "The verification code is incorrect. Please check and try again.";
  }
  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("over_email_send_rate_limit")
  ) {
    return "Too many attempts. Please wait a moment before trying again.";
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network error") ||
    lower.includes("networkrequestfailed")
  ) {
    return "Unable to connect to the server. Please check your internet connection.";
  }
  if (
    lower.includes("pgrst") ||
    lower.includes("postgres") ||
    lower.includes("relation") ||
    lower.includes("syntax error") ||
    lower.includes("violates foreign key")
  ) {
    return "A temporary database error occurred. Please refresh or contact support if the issue persists.";
  }

  return raw;
}

export type OAuthProvider = "google" | "apple";

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone: string;
  dob: string | null;
  board: string;
  standard: string;
  parentName: string;
  parentPhone: string;
}

export interface RegisterResult {
  email: string;
  userId: string;
  needsVerification: boolean;
}

export interface VerifyOtpPayload {
  email: string;
  token: string;
  type?: "signup" | "email" | "recovery" | "invite" | "magiclink" | "email_change";
}

export const authApi = {
  /**
   * Standard email + password login
   * Verifies credentials, verifies email confirmation status, and loads complete profile.
   */
  async login(email: string, password: string): Promise<RoleAccount> {
    const trimmedEmail = email.trim().toLowerCase();

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (
        error.code === "email_not_confirmed" ||
        msg.includes("email not confirmed") ||
        msg.includes("not verified")
      ) {
        throw new AuthError(
          "email_not_confirmed",
          "Your email address is not verified. Please enter the verification code sent to your email.",
        );
      }
      throw new AuthError("invalid_credentials", "Invalid email or password.");
    }

    if (!data.user) {
      throw new AuthError("invalid_credentials", "Failed to sign in. Please try again.");
    }

    // Strict email verification check for email/password users
    const isEmailProvider =
      data.user.app_metadata?.provider === "email" || !data.user.app_metadata?.provider;
    const isVerified = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);

    if (isEmailProvider && !isVerified) {
      // Sign out unverified session immediately
      await supabase.auth.signOut();
      clearCurrentUserCache();
      throw new AuthError(
        "email_not_confirmed",
        "Your email address is not verified. Please enter the verification code sent to your email.",
      );
    }

    // Fetch complete user profile from database
    let account = await fetchCompleteProfile(data.user.id);

    // If profile is missing but auth user exists (e.g. first-time OAuth or recovery), resolve safely
    if (!account) {
      account = await this.resolveOAuthProfile(data.user);
    }

    if (!account) {
      throw new AuthError("user_not_found", "User profile not found. Please contact support.");
    }

    return account;
  },

  /**
   * Send real email verification OTP directly to the specified email during registration
   */
  async sendInlineEmailOtp(email: string): Promise<void> {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      throw new AuthError("invalid_email", "Please enter a valid email address.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      throw new AuthError("invalid_email", "Please enter a valid email address format.");
    }

    // Check if user already exists in the users table
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", trimmedEmail)
      .maybeSingle();

    if (existingUser) {
      throw new AuthError(
        "email_already_exists",
        "An account with this email already exists. Please sign in instead.",
      );
    }

    // Send real OTP via Supabase Auth
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      throw new AuthError(
        "otp_send_failed",
        error.message || "Failed to send verification code. Please check your email.",
      );
    }
  },

  /**
   * Verify the inline 6-digit OTP code entered during registration
   */
  async verifyInlineEmailOtp(email: string, token: string): Promise<SupabaseAuthUser> {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedToken = token.trim();

    if (!trimmedToken || trimmedToken.length !== 6) {
      throw new AuthError("invalid_otp", "Please enter the complete 6-digit verification code.");
    }

    // Attempt verify with type 'email'
    let { data, error } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token: trimmedToken,
      type: "email",
    });

    // Fallback to type 'signup' if needed
    if (error) {
      const retry = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedToken,
        type: "signup",
      });
      if (!retry.error && retry.data.user) {
        data = retry.data;
        error = null;
      }
    }

    if (error || !data?.user) {
      const msg = (error?.message || "").toLowerCase();
      if (error?.code === "otp_expired" || msg.includes("expired")) {
        throw new AuthError("otp_expired", "Verification code expired. Please request a new code.");
      }
      throw new AuthError("invalid_otp", "Invalid verification code.");
    }

    return data.user;
  },

  /**
   * Complete registration after inline email verification succeeds:
   * Sets user password, creates users row, and creates students row.
   */
  async completeInlineRegistration(payload: RegisterPayload): Promise<RegisterResult> {
    const trimmedEmail = payload.email.trim().toLowerCase();

    // Check if current session user exists
    const {
      data: { user: activeUser },
    } = await supabase.auth.getUser();

    let userId: string;

    if (activeUser && activeUser.email?.toLowerCase() === trimmedEmail) {
      // Set the password and update metadata on authenticated user
      const { data: updated, error: updateErr } = await supabase.auth.updateUser({
        password: payload.password,
        data: {
          name: payload.name.trim(),
          phone: payload.phone.trim(),
          dob: payload.dob,
          board: payload.board,
          standard: payload.standard,
          parentName: payload.parentName,
          parentPhone: payload.parentPhone,
          role: "student",
        },
      });

      if (updateErr) {
        throw new AuthError(
          "registration_failed",
          updateErr.message || "Failed to finalize account credentials.",
        );
      }
      userId = updated.user.id;
    } else {
      // Fallback sign up if session disconnected
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: payload.password,
        options: {
          data: {
            name: payload.name.trim(),
            phone: payload.phone.trim(),
            dob: payload.dob,
            board: payload.board,
            standard: payload.standard,
            parentName: payload.parentName,
            parentPhone: payload.parentPhone,
            role: "student",
          },
        },
      });

      if (signUpErr && !signUpErr.message?.toLowerCase().includes("already registered")) {
        throw new AuthError("registration_failed", signUpErr.message);
      }

      const foundUser = signUpData?.user || (await supabase.auth.getUser()).data.user;
      if (!foundUser) {
        throw new AuthError("registration_failed", "Unable to create account. Please try again.");
      }
      userId = foundUser.id;
    }

    // Insert or update users table record
    const { error: userInsertError } = await supabase.from("users").upsert(
      {
        id: userId,
        email: trimmedEmail,
        role: "student",
        name: payload.name.trim(),
        phone: payload.phone.trim(),
      },
      { onConflict: "id" },
    );

    if (userInsertError) {
      console.error("Error creating users row:", userInsertError);
    }

    // Insert or update students table record with verified profile details
    const { data: studentRec } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (studentRec) {
      await supabase
        .from("students")
        .update({
          board: payload.board || "CBSE",
          standard: payload.standard || "10th",
          dob: payload.dob || null,
          parent_name: payload.parentName || null,
          parent_phone: payload.parentPhone || null,
        })
        .eq("user_id", userId);
    } else {
      const { error: studentInsertError } = await supabase.from("students").insert({
        user_id: userId,
        board: payload.board || "CBSE",
        standard: payload.standard || "10th",
        dob: payload.dob || null,
        parent_name: payload.parentName || null,
        parent_phone: payload.parentPhone || null,
      });

      if (studentInsertError && studentInsertError.code !== "23505") {
        console.error("Error creating students row:", studentInsertError);
      }
    }

    // Explicitly sign out so user logs in cleanly from /login
    await supabase.auth.signOut();
    clearCurrentUserCache();

    return {
      email: trimmedEmail,
      userId,
      needsVerification: false,
    };
  },

  /**
   * Register a new student account (Direct / Full)
   */
  async register(payload: RegisterPayload): Promise<RegisterResult> {
    return this.completeInlineRegistration(payload);
  },

  /**
   * Verify email OTP code via Supabase Auth
   * Handles role preservation for students, teachers, and admins without role assumption.
   */
  async verifyOtp(payload: VerifyOtpPayload): Promise<{
    user: SupabaseAuthUser;
    account: RoleAccount | null;
  }> {
    const trimmedEmail = payload.email.trim().toLowerCase();
    const trimmedToken = payload.token.trim();
    const type = payload.type || "signup";

    if (!trimmedToken) {
      throw new AuthError("invalid_otp", "Please enter the 6-digit verification code.");
    }

    // Verify OTP code with Supabase Auth
    let { data, error } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token: trimmedToken,
      type: type as any,
    });

    // If signup OTP fails, attempt with type: 'email' (for email change or alternate signup token)
    if (error && type === "signup") {
      const retry = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedToken,
        type: "email" as any,
      });
      if (!retry.error && retry.data.user) {
        data = retry.data;
        error = null;
      }
    }

    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (
        error.code === "otp_expired" ||
        msg.includes("expired") ||
        msg.includes("invalid") ||
        msg.includes("token")
      ) {
        throw new AuthError(
          "invalid_otp",
          "The verification code is invalid or has expired. Please check the code or request a new one.",
        );
      }
      throw new AuthError("verify_failed", error.message || "Failed to verify email.");
    }

    if (!data.user) {
      throw new AuthError("verify_failed", "Verification failed. Please try again.");
    }

    const authUser = data.user;

    // Check if user record already exists in database
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, email, role, name, phone")
      .eq("id", authUser.id)
      .single();

    if (!existingUser) {
      // Read metadata passed during signup
      const meta = authUser.user_metadata || {};
      const assignedRole: Role = (meta.role as Role) || "student";
      const name = meta.name || trimmedEmail.split("@")[0] || "User";
      const phone = meta.phone || "";

      // Insert base user record
      const { error: userInsertError } = await supabase.from("users").insert({
        id: authUser.id,
        email: trimmedEmail,
        role: assignedRole,
        name,
        phone,
      });

      if (userInsertError && userInsertError.code !== "23505") {
        console.error("Error creating user record after OTP:", userInsertError);
      }

      // Create or update matching role profile (student -> students, teacher -> teachers, admin -> admins)
      if (assignedRole === "student") {
        const { data: studentRec } = await supabase
          .from("students")
          .select("id")
          .eq("user_id", authUser.id)
          .single();

        if (studentRec) {
          await supabase
            .from("students")
            .update({
              board: meta.board || "",
              standard: meta.standard || "",
              dob: meta.dob || null,
              parent_name: meta.parentName || null,
              parent_phone: meta.parentPhone || null,
            })
            .eq("user_id", authUser.id);
        } else {
          await supabase.from("students").insert({
            user_id: authUser.id,
            board: meta.board || "",
            standard: meta.standard || "",
            dob: meta.dob || null,
            parent_name: meta.parentName || null,
            parent_phone: meta.parentPhone || null,
          });
        }
      } else if (assignedRole === "teacher") {
        const { data: teacherRec } = await supabase
          .from("teachers")
          .select("id")
          .eq("user_id", authUser.id)
          .single();

        if (teacherRec) {
          await supabase
            .from("teachers")
            .update({
              qualification: meta.qualification || "",
              experience_years: meta.experienceYears || 0,
              bio: meta.bio || "",
            })
            .eq("user_id", authUser.id);
        } else {
          await supabase.from("teachers").insert({
            user_id: authUser.id,
            qualification: meta.qualification || "",
            experience_years: meta.experienceYears || 0,
            bio: meta.bio || "",
          });
        }
      } else if (assignedRole === "admin") {
        const { data: adminRec } = await supabase
          .from("admins")
          .select("id")
          .eq("user_id", authUser.id)
          .single();

        if (!adminRec) {
          await supabase.from("admins").insert({
            user_id: authUser.id,
          });
        }
      }
    }

    // Fetch the resolved profile
    const account = await fetchCompleteProfile(authUser.id);

    return {
      user: authUser,
      account,
    };
  },

  /**
   * Resend email verification OTP
   */
  async resendVerificationOtp(email: string): Promise<void> {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      throw new AuthError("invalid_email", "Email is required to resend verification code.");
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: trimmedEmail,
    });

    if (error) {
      // A retry after a rate-limit response would send a second request immediately
      // and extend the user's wait. Surface the original error instead.
      const isRateLimited =
        error.status === 429 ||
        /rate limit|too many requests|over_email_send_rate_limit/i.test(error.message || "");

      if (isRateLimited) {
        throw new AuthError("resend_rate_limited", error.message);
      }

      // Fallback attempt with signInWithOtp
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: { shouldCreateUser: false },
      });

      if (otpError) {
        throw new AuthError(
          "resend_failed",
          error.message ||
            otpError.message ||
            "Failed to resend verification code. Please try again.",
        );
      }
    }
  },

  /**
   * Initiate OAuth sign in (Google, Apple)
   */
  async signInWithOAuth(provider: OAuthProvider): Promise<void> {
    const redirectUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : "http://localhost:3000/auth/callback";

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      throw new AuthError("oauth_failed", error.message || `Failed to sign in with ${provider}.`);
    }

    if (data?.url && typeof window !== "undefined") {
      window.location.href = data.url;
    }
  },

  /**
   * Safe profile resolution for OAuth & federated logins
   * - Preserves existing teacher/admin/student roles and profiles
   * - Creates new student profile ONLY when genuinely new
   * - Does NOT invent dummy board/standard values (leaves empty for onboarding)
   * - Prevents duplicate users/students/teachers/admins rows
   */
  async resolveOAuthProfile(authUser: SupabaseAuthUser): Promise<RoleAccount | null> {
    if (!authUser?.id) return null;

    const email = (authUser.email || "").toLowerCase();

    // 1. Check if user already exists in users table by ID
    let { data: existingUser } = await supabase
      .from("users")
      .select("id, email, role, name, phone")
      .eq("id", authUser.id)
      .single();

    // 2. If not found by ID, check by email (in case user existed previously)
    if (!existingUser && email) {
      const { data: byEmail } = await supabase
        .from("users")
        .select("id, email, role, name, phone")
        .eq("email", email)
        .single();
      if (byEmail) {
        existingUser = byEmail;
      }
    }

    // 3. If user exists: PRESERVE EXACT ROLE & PROFILE
    if (existingUser) {
      const role = existingUser.role as Role;

      // Ensure appropriate profile row exists for their existing role without overwriting
      if (role === "student") {
        const { data: studentRec } = await supabase
          .from("students")
          .select("id")
          .eq("user_id", existingUser.id)
          .single();

        if (!studentRec) {
          await supabase.from("students").insert({
            user_id: existingUser.id,
            board: "",
            standard: "",
          });
        }
      } else if (role === "teacher") {
        const { data: teacherRec } = await supabase
          .from("teachers")
          .select("id")
          .eq("user_id", existingUser.id)
          .single();

        if (!teacherRec) {
          await supabase.from("teachers").insert({
            user_id: existingUser.id,
          });
        }
      } else if (role === "admin") {
        const { data: adminRec } = await supabase
          .from("admins")
          .select("id")
          .eq("user_id", existingUser.id)
          .single();

        if (!adminRec) {
          await supabase.from("admins").insert({
            user_id: existingUser.id,
          });
        }
      }

      return fetchCompleteProfile(existingUser.id);
    }

    // 4. Genuinely new OAuth user: default strictly to 'student'
    // Extract name from OAuth metadata safely
    const meta = authUser.user_metadata || {};
    const name =
      meta.full_name || meta.name || meta.user_name || (email ? email.split("@")[0] : "Student");
    const phone = meta.phone || "";

    // Insert new student user row
    const { error: userError } = await supabase.from("users").insert({
      id: authUser.id,
      email,
      role: "student",
      name,
      phone,
    });

    if (userError && userError.code !== "23505") {
      console.error("Error creating OAuth user:", userError);
      return null;
    }

    // Insert or update student profile with empty board/standard (missing info to be completed by user in onboarding)
    const { data: existingStudent } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", authUser.id)
      .single();

    if (existingStudent) {
      await supabase
        .from("students")
        .update({
          board: "",
          standard: "",
        })
        .eq("user_id", authUser.id);
    } else {
      const { error: studentError } = await supabase.from("students").insert({
        user_id: authUser.id,
        board: "",
        standard: "",
      });

      if (studentError && studentError.code !== "23505") {
        console.error("Error creating OAuth student profile:", studentError);
      }
    }

    return fetchCompleteProfile(authUser.id);
  },

  /**
   * Log out the current user and clear cache
   */
  async logout(): Promise<void> {
    clearCurrentUserCache();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new AuthError("logout_failed", error.message || "Failed to sign out.");
    }
  },

  /**
   * Send password reset email
   */
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
