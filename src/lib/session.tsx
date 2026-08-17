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
  const { data: userRecord, error } = await supabase
    .from("users")
    .select("id, email, role, name, phone")
    .eq("id", userId)
    .single();

  if (error || !userRecord) return null;

  const account: RoleAccount = {
    id: userRecord.id,
    role: userRecord.role as Role,
    email: userRecord.email,
    password: "",
    name: userRecord.name,
    phone: userRecord.phone || "",
  };

  if (userRecord.role === "student") {
    const { data: studentRecord } = await supabase
      .from("students")
      .select("*")
      .eq("user_id", userRecord.id)
      .single();

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
      board: studentRecord?.board || "CBSE",
      standard: studentRecord?.standard || "10th",
      dob: studentRecord?.dob || "",
      parentName: studentRecord?.parent_name || "",
      parentPhone: studentRecord?.parent_phone || "",
      subjectIds,
    } as StudentProfile;
  } else if (userRecord.role === "teacher") {
    const { data: teacherRecord } = await supabase
      .from("teachers")
      .select("*")
      .eq("user_id", userRecord.id)
      .single();

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
      qualification: teacherRecord?.qualification || "",
      experienceYears: teacherRecord?.experience_years || 0,
      bio: teacherRecord?.bio || "",
      standards: ["10th", "12th"],
      subjectIds,
    } as TeacherProfile;
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

  // Initialize session from Supabase Auth on mount
  useEffect(() => {
    let mounted = true;

    const initializeSession = async () => {
      try {
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();

        if (authSession?.user && mounted) {
          const account = await fetchCompleteProfile(authSession.user.id);
          if (account && mounted) {
            setCurrentUserCache(account);
            setSession(account);
            setStatus("authenticated");
            return;
          }
        }
        if (mounted) setStatus("unauthenticated");
      } catch (err) {
        console.error("Failed to initialize session:", err);
        if (mounted) setStatus("unauthenticated");
      }
    };

    initializeSession();

    return () => {
      mounted = false;
    };
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, authSession) => {
      if (authSession?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        const account = await fetchCompleteProfile(authSession.user.id);
        if (account) {
          setCurrentUserCache(account);
          setSession(account);
          setStatus("authenticated");
        }
      } else if (event === "SIGNED_OUT") {
        clearCurrentUserCache();
        setSession(null);
        setStatus("unauthenticated");
      }
    });

    return () => {
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
