import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/lib/db/client";
import { clearCurrentUserCache, setCurrentUserCache } from "@/lib/route-guards";
import type { AdminProfile, Role, RoleAccount, StudentProfile, TeacherProfile } from "@/lib/types";

const emptyTeacher: TeacherProfile = {
  id: "",
  role: "teacher",
  email: "",
  password: "",
  name: "",
  phone: "",
  qualification: "",
  experienceYears: 0,
  bio: "",
  standards: [],
  subjectIds: [],
};
const emptyStudent: StudentProfile = {
  id: "",
  role: "student",
  email: "",
  password: "",
  name: "",
  phone: "",
  board: "",
  standard: "",
  dob: "",
  subjectIds: [],
};
const emptyAdmin: AdminProfile = {
  id: "",
  role: "admin",
  email: "",
  password: "",
  name: "",
  phone: "",
};

export function homeForRole(role: Role) {
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

/**
 * Helper to fetch complete user profile in parallel
 */
export async function fetchCompleteProfile(userId: string): Promise<RoleAccount | null> {
  if (!userId) return null;

  const { data: initialUser, error } = await supabase
    .from("users")
    .select("id, email, role, name, phone")
    .eq("id", userId)
    .maybeSingle();

  let userRecord = initialUser;

  // If not found by ID, check if auth user exists and look up by email
  if (!userRecord) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (authUser && (authUser.id === userId || authUser.email)) {
      const email = authUser.email?.toLowerCase();
      if (email) {
        const { data: byEmail } = await supabase
          .from("users")
          .select("id, email, role, name, phone")
          .eq("email", email)
          .maybeSingle();

        if (byEmail) {
          userRecord = byEmail;
        } else {
          // Auto-provision user record from auth metadata
          const meta = authUser.user_metadata || {};
          const assignedRole: Role = (meta.role as Role) || "student";
          const name = meta.name || email.split("@")[0] || "User";
          const phone = meta.phone || "";

          const { data: createdUser } = await supabase
            .from("users")
            .insert({
              id: authUser.id,
              email,
              role: assignedRole,
              name,
              phone,
            })
            .select("id, email, role, name, phone")
            .maybeSingle();

          if (createdUser) {
            userRecord = createdUser;
          }
        }
      }
    }
  }

  if (error || !userRecord) return null;

  const account: RoleAccount = {
    id: userRecord.id,
    userId: userRecord.id,
    role: userRecord.role as Role,
    email: userRecord.email,
    password: "",
    name: userRecord.name,
    phone: userRecord.phone || "",
  };

  if (userRecord.role === "student") {
    let { data: studentRecord } = await supabase
      .from("students")
      .select("*")
      .eq("user_id", userRecord.id)
      .maybeSingle();

    if (!studentRecord) {
      const { data: createdStudent } = await supabase
        .from("students")
        .insert({
          user_id: userRecord.id,
          board: "",
          standard: "",
        })
        .select("*")
        .maybeSingle();
      if (createdStudent) {
        studentRecord = createdStudent;
      }
    }

    let subjectIds: string[] = [];
    if (studentRecord) {
      const { data: enrollmentData } = await supabase
        .from("enrollments")
        .select("subject_id")
        .eq("student_id", studentRecord.id)
        .eq("status", "active");
      subjectIds = (enrollmentData || []).map((e: any) => e.subject_id);
    }

    return {
      ...account,
      id: studentRecord?.id || userRecord.id,
      userId: userRecord.id,
      board: studentRecord?.board || "CBSE",
      standard: studentRecord?.standard || "10th",
      dob: studentRecord?.dob || "",
      parentName: studentRecord?.parent_name || "",
      parentPhone: studentRecord?.parent_phone || "",
      subjectIds,
    } as StudentProfile;
  } else if (userRecord.role === "teacher") {
    let { data: teacherRecord } = await supabase
      .from("teachers")
      .select("*")
      .eq("user_id", userRecord.id)
      .maybeSingle();

    if (!teacherRecord) {
      const { data: createdTeacher } = await supabase
        .from("teachers")
        .insert({
          user_id: userRecord.id,
        })
        .select("*")
        .maybeSingle();
      if (createdTeacher) {
        teacherRecord = createdTeacher;
      }
    }

    let subjectIds: string[] = [];
    if (teacherRecord) {
      const { data: subjectData } = await supabase
        .from("subjects")
        .select("id")
        .eq("teacher_id", teacherRecord.id);
      subjectIds = (subjectData || []).map((s: any) => s.id);
    }

    return {
      ...account,
      id: teacherRecord?.id || userRecord.id,
      userId: userRecord.id,
      qualification: teacherRecord?.qualification || "",
      experienceYears: teacherRecord?.experience_years || 0,
      bio: teacherRecord?.bio || "",
      standards: ["10th", "12th"],
      subjectIds,
    } as TeacherProfile;
  } else if (userRecord.role === "admin") {
    let { data: adminRecord } = await supabase
      .from("admins")
      .select("*")
      .eq("user_id", userRecord.id)
      .maybeSingle();

    if (!adminRecord) {
      const { data: createdAdmin } = await supabase
        .from("admins")
        .insert({
          user_id: userRecord.id,
        })
        .select("*")
        .maybeSingle();
      if (createdAdmin) {
        adminRecord = createdAdmin;
      }
    }

    return {
      ...account,
      id: adminRecord?.id || userRecord.id,
      userId: userRecord.id,
    } as AdminProfile;
  }

  return account;
}

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionContextValue {
  session: RoleAccount | null;
  status: SessionStatus;
  student: StudentProfile;
  teacher: TeacherProfile;
  admin: AdminProfile;
  signIn: (account: RoleAccount) => void;
  signOut: () => void;
  enroll: (subjectId: string) => void;
  updateStudent: (patch: Partial<StudentProfile>) => void;
  isEnrolled: (subjectId: string) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<RoleAccount | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  // Sync session state from Supabase Auth
  useEffect(() => {
    let mounted = true;

    const syncSession = async (authSession: any) => {
      try {
        if (authSession?.user && mounted) {
          const isEmailProvider =
            authSession.user.app_metadata?.provider === "email" ||
            !authSession.user.app_metadata?.provider;
          const isVerified = Boolean(
            authSession.user.email_confirmed_at || authSession.user.confirmed_at,
          );

          if (isEmailProvider && !isVerified) {
            clearCurrentUserCache();
            if (mounted) {
              setSession(null);
              setStatus("unauthenticated");
            }
            return;
          }

          const account = await fetchCompleteProfile(authSession.user.id);
          if (account && mounted) {
            setCurrentUserCache(account);
            setSession(account);
            setStatus("authenticated");
            return;
          }
        }
        if (mounted) {
          clearCurrentUserCache();
          setSession(null);
          setStatus("unauthenticated");
        }
      } catch (err) {
        console.error("Session sync error:", err);
        if (mounted) {
          clearCurrentUserCache();
          setSession(null);
          setStatus("unauthenticated");
        }
      }
    };

    // 1. Listen to all auth state changes (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, SIGNED_OUT)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, authSession) => {
      if (!mounted) return;
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        await syncSession(authSession);
      } else if (event === "SIGNED_OUT") {
        clearCurrentUserCache();
        setSession(null);
        setStatus("unauthenticated");
      }
    });

    // 2. Immediate getSession check on initial mount
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      if (!mounted) return;
      if (authSession) {
        syncSession(authSession);
      } else {
        // Allow a brief tick for Supabase local storage recovery
        setTimeout(() => {
          if (mounted && status === "loading") {
            setStatus("unauthenticated");
          }
        }, 150);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const student = useMemo(
    () => (session && session.role === "student" ? (session as StudentProfile) : emptyStudent),
    [session],
  );
  const teacher = useMemo(
    () => (session && session.role === "teacher" ? (session as TeacherProfile) : emptyTeacher),
    [session],
  );
  const admin = useMemo(
    () => (session && session.role === "admin" ? (session as AdminProfile) : emptyAdmin),
    [session],
  );

  const signIn = useCallback((account: RoleAccount) => {
    setCurrentUserCache(account);
    setSession(account);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(() => {
    clearCurrentUserCache();
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  const enroll = useCallback((subjectId: string) => {
    setSession((current) => {
      if (!current || current.role !== "student") return current;
      const subjectIds = current.subjectIds ?? [];
      if (subjectIds.includes(subjectId)) return current;
      return { ...current, subjectIds: [...subjectIds, subjectId] } as StudentProfile;
    });
  }, []);

  const updateStudent = useCallback((patch: Partial<StudentProfile>) => {
    setSession((current) => {
      if (!current || current.role !== "student") return current;
      return { ...current, ...patch } as StudentProfile;
    });
  }, []);

  const isEnrolled = useCallback(
    (subjectId: string) => student.subjectIds.includes(subjectId),
    [student.subjectIds],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      status,
      student,
      teacher,
      admin,
      signIn,
      signOut,
      enroll,
      updateStudent,
      isEnrolled,
    }),
    [session, status, student, teacher, admin, signIn, signOut, enroll, updateStudent, isEnrolled],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
