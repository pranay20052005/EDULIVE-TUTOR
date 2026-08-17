import {
  BarChart3,
  BookOpen,
  ClipboardList,
  CreditCard,
  Compass,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Bell,
  PlaySquare,
  Radio,
  Settings,
  Trophy,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { CalendarCheck, FileQuestion } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Role } from "@/lib/types";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  exact?: boolean;
  primary?: boolean;
}

export const navByRole: Record<Role, NavItem[]> = {
  student: [
    { label: "Dashboard", to: "/app", icon: LayoutDashboard, exact: true, primary: true },
    { label: "My Subjects", to: "/app/subjects", icon: BookOpen, primary: true },
    { label: "Courses", to: "/app/courses", icon: Compass, primary: true },
    { label: "Live Classes", to: "/app/live", icon: Radio, primary: true },
    { label: "Recorded", to: "/app/recordings", icon: PlaySquare },
    { label: "Notes", to: "/app/notes", icon: FileText },
    { label: "Assignments", to: "/app/assignments", icon: ClipboardList },
    { label: "Tests", to: "/app/tests", icon: Trophy },
    { label: "Results", to: "/app/results", icon: BarChart3 },
    { label: "Attendance", to: "/app/attendance", icon: CalendarCheck },
    { label: "Notifications", to: "/app/notifications", icon: Bell },
    { label: "Profile", to: "/app/profile", icon: UserRound, primary: true },
  ],
  teacher: [
    { label: "Dashboard", to: "/teacher", icon: LayoutDashboard, exact: true, primary: true },
    { label: "My Subjects", to: "/teacher/subjects", icon: BookOpen, primary: true },
    { label: "Students", to: "/teacher/students", icon: Users, primary: true },
    { label: "Notes & PDFs", to: "/teacher/notes", icon: FileText },
    { label: "Question Papers", to: "/teacher/question-papers", icon: FileQuestion },
    { label: "Tests", to: "/teacher/tests", icon: Trophy },
    { label: "Assignments", to: "/teacher/assignments", icon: FileText },
    { label: "Recorded", to: "/teacher/recordings", icon: Video },
    { label: "Live Classes", to: "/teacher/live", icon: Radio, primary: true },
    { label: "Attendance", to: "/teacher/attendance", icon: ClipboardList, primary: true },
    { label: "Performance", to: "/teacher/performance", icon: BarChart3 },
    { label: "Profile", to: "/teacher/profile", icon: UserRound, primary: true },
  ],
  admin: [
    { label: "Dashboard", to: "/admin", icon: LayoutDashboard, exact: true, primary: true },
    { label: "Students", to: "/admin/students", icon: Users, primary: true },
    { label: "Teachers", to: "/admin/teachers", icon: GraduationCap, primary: true },
    { label: "Subjects", to: "/admin/subjects", icon: Layers, primary: true },
    { label: "Subscriptions", to: "/admin/subscriptions", icon: CreditCard },
    { label: "Reports", to: "/admin/reports", icon: BarChart3 },
    { label: "Settings", to: "/admin/settings", icon: Settings },
  ],
};

export const roleLabel: Record<Role, string> = {
  student: "Student",
  teacher: "Faculty",
  admin: "Administrator",
};
