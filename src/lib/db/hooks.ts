/**
 * React Query Hooks for Database Services
 * Provides convenient data fetching with automatic caching and state management
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  subjectService,
  enrollmentService,
  studentService,
  teacherService,
  userService,
  assignmentService,
  materialService,
  scheduledClassService,
  attendanceService,
  testAttemptService,
  testService,
  questionPaperService,
  notificationService,
  announcementService,
  recordingService,
  chapterService,
  paymentService,
  subscriptionPlanService,
} from "@/lib/db";
import type { Student, Teacher, Subject, Enrollment, FacultyAssignment } from "@/lib/db/types";

// ============================================================
// STUDENT QUERIES
// ============================================================

export function useStudentProfile(userId: string) {
  return useQuery({
    queryKey: ["student", userId],
    queryFn: () => studentService.getByUserId(userId),
    enabled: !!userId,
  });
}

export function useStudentEnrollments(studentId: string | undefined) {
  return useQuery({
    queryKey: ["enrollments", studentId],
    queryFn: () =>
      studentId ? enrollmentService.getStudentEnrollments(studentId) : Promise.resolve([]),
    enabled: !!studentId,
  });
}

// ============================================================
// SUBJECT QUERIES
// ============================================================

export function usePublishedSubjects(filter?: { standard?: string; searchText?: string }) {
  return useQuery({
    queryKey: ["subjects", filter],
    queryFn: () => subjectService.listPublished(filter),
  });
}

export function useSubject(id: string | undefined) {
  return useQuery({
    queryKey: ["subject", id],
    queryFn: () => (id ? subjectService.getById(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}

export function useTeacherSubjects(teacherId: string | undefined) {
  return useQuery({
    queryKey: ["teacher-subjects", teacherId],
    queryFn: () => (teacherId ? subjectService.listByTeacher(teacherId) : Promise.resolve([])),
    enabled: !!teacherId,
  });
}

// ============================================================
// ASSIGNMENT QUERIES
// ============================================================

export function useAssignmentsBySubject(
  subjectId: string | undefined,
  options?: { published?: boolean },
) {
  return useQuery({
    queryKey: ["assignments", subjectId, options],
    queryFn: () =>
      subjectId ? assignmentService.listBySubject(subjectId, options) : Promise.resolve([]),
    enabled: !!subjectId,
  });
}

export function useAssignmentsByTeacher(teacherId: string | undefined) {
  return useQuery({
    queryKey: ["teacher-assignments", teacherId],
    queryFn: () => (teacherId ? assignmentService.listByTeacher(teacherId) : Promise.resolve([])),
    enabled: !!teacherId,
  });
}

// ============================================================
// MATERIALS QUERIES
// ============================================================

export function useMaterialsBySubject(
  subjectId: string | undefined,
  options?: { published?: boolean },
) {
  return useQuery({
    queryKey: ["materials", subjectId, options],
    queryFn: () =>
      subjectId ? materialService.listBySubject(subjectId, options) : Promise.resolve([]),
    enabled: !!subjectId,
  });
}

export function useMaterialsByChapter(
  chapterId: string | undefined,
  options?: { published?: boolean },
) {
  return useQuery({
    queryKey: ["chapter-materials", chapterId, options],
    queryFn: () =>
      chapterId ? materialService.listByChapter(chapterId, options) : Promise.resolve([]),
    enabled: !!chapterId,
  });
}

// ============================================================
// CHAPTER QUERIES
// ============================================================

export function useChaptersBySubject(subjectId: string | undefined) {
  return useQuery({
    queryKey: ["chapters", subjectId],
    queryFn: () => (subjectId ? chapterService.listBySubject(subjectId) : Promise.resolve([])),
    enabled: !!subjectId,
  });
}

// ============================================================
// SCHEDULED CLASSES QUERIES
// ============================================================

export function useScheduledClassesBySubject(subjectId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ["scheduled-classes", subjectId, status],
    queryFn: () =>
      subjectId
        ? scheduledClassService.listBySubject(subjectId, status ? { status } : undefined)
        : Promise.resolve([]),
    enabled: !!subjectId,
  });
}

export function useScheduledClassesByTeacher(teacherId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ["teacher-scheduled-classes", teacherId, status],
    queryFn: () =>
      teacherId
        ? scheduledClassService.listByTeacher(teacherId, status ? { status } : undefined)
        : Promise.resolve([]),
    enabled: !!teacherId,
  });
}

export function useUpcomingClassesForStudent(studentId: string | undefined) {
  return useQuery({
    queryKey: ["upcoming-classes", studentId],
    queryFn: () =>
      studentId ? scheduledClassService.listForStudent(studentId) : Promise.resolve([]),
    enabled: !!studentId,
  });
}

// ============================================================
// ATTENDANCE QUERIES
// ============================================================

export function useStudentAttendance(studentId: string | undefined, subjectId?: string) {
  return useQuery({
    queryKey: ["attendance", studentId, subjectId],
    queryFn: () =>
      studentId
        ? attendanceService.listByStudent(studentId, subjectId ? { subjectId } : undefined)
        : Promise.resolve([]),
    enabled: !!studentId,
  });
}

export function useStudentAttendanceSummary(studentId: string | undefined, subjectId?: string) {
  return useQuery({
    queryKey: ["attendance-summary", studentId, subjectId],
    queryFn: () =>
      studentId
        ? attendanceService.getSummaryByStudent(studentId, subjectId)
        : Promise.resolve(null),
    enabled: !!studentId,
  });
}

// ============================================================
// TEST ATTEMPT QUERIES
// ============================================================

export function useStudentTestAttempts(studentId: string | undefined) {
  return useQuery({
    queryKey: ["test-attempts", studentId],
    queryFn: () => (studentId ? testAttemptService.listByStudent(studentId) : Promise.resolve([])),
    enabled: !!studentId,
  });
}

export function useStudentTestAttempt(testId: string | undefined, studentId: string | undefined) {
  return useQuery({
    queryKey: ["test-attempt", testId, studentId],
    queryFn: () =>
      testId && studentId
        ? testAttemptService.getStudentAttempt(testId, studentId)
        : Promise.resolve(null),
    enabled: !!testId && !!studentId,
  });
}

// ============================================================
// NOTIFICATIONS QUERIES
// ============================================================

export function useUserNotifications(userId: string | undefined, unreadOnly?: boolean) {
  return useQuery({
    queryKey: ["notifications", userId, unreadOnly],
    queryFn: () =>
      userId
        ? notificationService.listByUser(
            userId,
            unreadOnly !== undefined ? { unread: unreadOnly } : undefined,
          )
        : Promise.resolve([]),
    enabled: !!userId,
  });
}

export function useUnreadNotificationCount(userId: string | undefined) {
  return useQuery({
    queryKey: ["unread-count", userId],
    queryFn: () => (userId ? notificationService.getUnreadCount(userId) : Promise.resolve(0)),
    enabled: !!userId,
  });
}

// ============================================================
// ANNOUNCEMENTS QUERIES
// ============================================================

export function usePublishedAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: () => announcementService.listPublished(),
  });
}

export function useAnnouncementsByTargetAudience(
  audience: "all" | "students" | "teachers" | "admin",
) {
  return useQuery({
    queryKey: ["announcements", audience],
    queryFn: () => announcementService.listByTargetAudience(audience),
  });
}

// ============================================================
// RECORDINGS QUERIES
// ============================================================

export function useRecordingsBySubject(
  subjectId: string | undefined,
  options?: { published?: boolean },
) {
  return useQuery({
    queryKey: ["recordings", subjectId, options],
    queryFn: () =>
      subjectId ? recordingService.listBySubject(subjectId, options) : Promise.resolve([]),
    enabled: !!subjectId,
  });
}

export function usePublishedRecordings() {
  return useQuery({
    queryKey: ["recordings-published"],
    queryFn: () => recordingService.listPublished(),
  });
}

export function usePublishedRecordingsBySubjects(subjectIds: string[]) {
  return useQuery({
    queryKey: ["recordings-published-by-subjects", subjectIds],
    queryFn: () => recordingService.listPublishedBySubjects(subjectIds),
    enabled: subjectIds.length > 0,
  });
}

export function useStudentRecordingProgress(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student-recording-progress", studentId],
    queryFn: () =>
      studentId
        ? import("@/lib/db/services/recording-progress").then((m) =>
            m.recordingProgressService.listForStudent(studentId),
          )
        : Promise.resolve([]),
    enabled: !!studentId,
  });
}

export function useRecordingProgress(
  studentId: string | undefined,
  recordingId: string | undefined,
) {
  return useQuery({
    queryKey: ["recording-progress", studentId, recordingId],
    queryFn: () =>
      studentId && recordingId
        ? import("@/lib/db/services/recording-progress").then((m) =>
            m.recordingProgressService.getProgress(studentId, recordingId),
          )
        : Promise.resolve(null),
    enabled: !!studentId && !!recordingId,
  });
}

// ============================================================
// SCHEDULED CLASSES QUERIES
// ============================================================

export function useScheduledClass(classId: string | undefined) {
  return useQuery({
    queryKey: ["scheduled-class", classId],
    queryFn: () => (classId ? scheduledClassService.getById(classId) : Promise.resolve(null)),
    enabled: !!classId,
  });
}

export function useScheduledClassesBySubjects(subjectIds: string[]) {
  return useQuery({
    queryKey: ["scheduled-classes-by-subjects", subjectIds],
    queryFn: () => scheduledClassService.listBySubjects(subjectIds),
    enabled: subjectIds.length > 0,
  });
}

export function useTeacherScheduledClasses(teacherId: string | undefined) {
  return useQuery({
    queryKey: ["teacher-classes", teacherId],
    queryFn: () =>
      teacherId ? scheduledClassService.listByTeacher(teacherId) : Promise.resolve([]),
    enabled: !!teacherId,
  });
}

// ============================================================
// TEACHER QUERIES
// ============================================================

export function useTeacherTests(teacherId: string | undefined) {
  return useQuery({
    queryKey: ["teacher-tests", teacherId],
    queryFn: () => (teacherId ? testService.listByTeacher(teacherId) : Promise.resolve([])),
    enabled: !!teacherId,
  });
}

export function useTeacherQuestionPapers(teacherId: string | undefined) {
  return useQuery({
    queryKey: ["teacher-question-papers", teacherId],
    queryFn: () =>
      teacherId ? questionPaperService.listByTeacher(teacherId) : Promise.resolve([]),
    enabled: !!teacherId,
  });
}

export function useTeacherMaterials(teacherId: string | undefined) {
  return useQuery({
    queryKey: ["teacher-materials", teacherId],
    queryFn: () => (teacherId ? materialService.listByTeacher(teacherId) : Promise.resolve([])),
    enabled: !!teacherId,
  });
}

export function useTeacherRecordings(teacherId: string | undefined) {
  return useQuery({
    queryKey: ["teacher-recordings", teacherId],
    queryFn: () => (teacherId ? recordingService.listByTeacher(teacherId) : Promise.resolve([])),
    enabled: !!teacherId,
  });
}

// ============================================================
// ADMIN QUERIES
// ============================================================

export function useAllStudents(filter?: { standard?: string; board?: string }) {
  return useQuery({
    queryKey: ["admin-students", filter],
    queryFn: () => studentService.listAll(filter),
  });
}

export function useAllTeachers() {
  return useQuery({
    queryKey: ["admin-teachers"],
    queryFn: () => teacherService.listAll(),
  });
}

export function useAllSubjects(filter?: { standard?: string }) {
  return useQuery({
    queryKey: ["admin-subjects", filter],
    queryFn: () => subjectService.listAll(filter),
  });
}

export function useStudentPayments(studentId: string | undefined, filter?: { status?: string }) {
  return useQuery({
    queryKey: ["student-payments", studentId, filter],
    queryFn: () =>
      studentId ? paymentService.listByStudent(studentId, filter) : Promise.resolve([]),
    enabled: !!studentId,
  });
}

export function useAdminRevenueSummary() {
  return useQuery({
    queryKey: ["admin-revenue-summary"],
    queryFn: () => paymentService.getAdminRevenueSummary(),
  });
}

export function useAllPayments(filter?: { status?: string }) {
  return useQuery({
    queryKey: ["admin-payments", filter],
    queryFn: () => paymentService.listAll(filter),
  });
}

export function useAllEnrollments(filter?: { status?: string }) {
  return useQuery({
    queryKey: ["admin-enrollments", filter],
    queryFn: () => enrollmentService.listAll(filter),
  });
}

export function useAllSubscriptionPlans() {
  return useQuery({
    queryKey: ["admin-subscription-plans"],
    queryFn: () => subscriptionPlanService.listAll(),
  });
}

export function useAllTestAttempts() {
  return useQuery({
    queryKey: ["admin-test-attempts"],
    queryFn: () => testAttemptService.listAll(),
  });
}

export function useAllAttendance() {
  return useQuery({
    queryKey: ["admin-all-attendance"],
    queryFn: () => attendanceService.listAll(),
  });
}

// ============================================================
// BATCHES & CERTIFICATES QUERIES
// ============================================================

export function useAllBatches(filter?: { subjectId?: string; standard?: string }) {
  return useQuery({
    queryKey: ["admin-batches", filter],
    queryFn: () => import("@/lib/db/services/batches").then((m) => m.batchService.listAll(filter)),
  });
}

export function useSubjectBatches(subjectId: string | undefined) {
  return useQuery({
    queryKey: ["subject-batches", subjectId],
    queryFn: () =>
      subjectId
        ? import("@/lib/db/services/batches").then((m) => m.batchService.listBySubject(subjectId))
        : Promise.resolve([]),
    enabled: !!subjectId,
  });
}

export function useTeacherBatches(teacherId: string | undefined) {
  return useQuery({
    queryKey: ["teacher-batches", teacherId],
    queryFn: () =>
      teacherId
        ? import("@/lib/db/services/batches").then((m) => m.batchService.listByTeacher(teacherId))
        : Promise.resolve([]),
    enabled: !!teacherId,
  });
}

export function useStudentCertificates(studentId: string | undefined) {
  return useQuery({
    queryKey: ["student-certificates", studentId],
    queryFn: () =>
      studentId
        ? import("@/lib/db/services/certificates").then((m) =>
            m.certificateService.listByStudent(studentId),
          )
        : Promise.resolve([]),
    enabled: !!studentId,
  });
}

export function useSubjectCertificate(
  studentId: string | undefined,
  subjectId: string | undefined,
) {
  return useQuery({
    queryKey: ["subject-certificate", studentId, subjectId],
    queryFn: () =>
      studentId && subjectId
        ? import("@/lib/db/services/certificates").then((m) =>
            m.certificateService.getByStudentAndSubject(studentId, subjectId),
          )
        : Promise.resolve(null),
    enabled: !!studentId && !!subjectId,
  });
}

// ============================================================
// MUTATIONS
// ============================================================

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assignmentService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      assignmentService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: attendanceService.markAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
