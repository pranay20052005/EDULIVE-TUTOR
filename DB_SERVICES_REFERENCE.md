# Database Services Quick Reference

Quick guide for using EduLive database services in Phase 2+.

## Import Pattern

```typescript
import {
  userService,
  studentService,
  subjectService,
  testService,
  enrollmentService,
} from "@/lib/db";
```

## User Service

### Get User by ID

```typescript
const user = await userService.getById("user-id");
// Returns: User | null
```

### Get User by Email

```typescript
const user = await userService.getByEmail("student@edulive.app");
// Returns: User | null
```

### Update User Profile

```typescript
await userService.updateProfile("user-id", {
  name: "New Name",
  phone: "+91 98765 43210",
});
```

### List All Users (Admin)

```typescript
await userService.listAll({ role: "student" });
// Returns: User[]
```

## Student Service

### Get Student Profile

```typescript
const student = await studentService.getById("student-id");
// Returns: Student | null (includes user data)
```

### Get Student by User ID

```typescript
const student = await studentService.getByUserId("auth-user-id");
// Returns: Student | null
```

### Get Student's Enrollments

```typescript
const enrollments = await studentService.getEnrollments("student-id");
// Returns: Enrollment[] (with subject data)
```

### Check if Enrolled in Subject

```typescript
const isEnrolled = await studentService.isEnrolledInSubject("student-id", "subject-id");
// Returns: boolean
```

### Update Student Profile

```typescript
await studentService.update("student-id", {
  standard: "11th",
  board: "CBSE",
});
```

## Subject Service

### Get Subject by ID

```typescript
const subject = await subjectService.getById("subject-id");
// Returns: Subject | null (includes teacher data)
```

### List Published Subjects

```typescript
const subjects = await subjectService.listPublished({
  standard: "10th",
  searchText: "Math",
});
// Returns: Subject[]
```

### List Teacher's Subjects

```typescript
const subjects = await subjectService.listByTeacher("teacher-id");
// Returns: Subject[]
```

### Get Subject Content

```typescript
const content = await subjectService.getContent("subject-id");
// Returns: {
//   materials: Material[],
//   tests: FacultyTest[],
//   assignments: FacultyAssignment[],
//   chapters: Chapter[]
// }
```

### Get Subject Enrollments

```typescript
const enrollments = await subjectService.getEnrollments("subject-id");
// Returns: Enrollment[] (with student data)
```

### Publish/Draft Subject

```typescript
await subjectService.setStatus("subject-id", "published");
// status: "draft" | "published"
```

## Test Service

### Get Test with Questions

```typescript
const test = await testService.getWithQuestions("test-id");
// Returns: FacultyTest & { questions: TestQuestion[] }
```

### List Subject's Tests

```typescript
const tests = await testService.listBySubject("subject-id", {
  status: "published",
});
// Returns: FacultyTest[]
```

### Get Student's Test Attempt

```typescript
const attempt = await testService.getStudentAttempt("test-id", "student-id");
// Returns: TestAttempt | null
```

### Start a Test

```typescript
const attempt = await testService.createAttempt({
  test_id: "test-id",
  student_id: "student-id",
});
// Returns: TestAttempt (with started_at timestamp)
```

### Submit Test

```typescript
await testService.submitAttempt(
  "attempt-id",
  marksObtained, // e.g., 15
  totalMarks, // e.g., 20
);
// Calculates percentage automatically
```

### Get All Attempts for Test (Teacher)

```typescript
const attempts = await testService.getAttempts("test-id");
// Returns: TestAttempt[] (with student data)
```

## Enrollment Service

### Check if Enrolled

```typescript
const enrolled = await enrollmentService.isEnrolled("student-id", "subject-id");
// Returns: boolean
```

### Get Student's Enrollments

```typescript
const enrollments = await enrollmentService.getStudentEnrollments("student-id");
// Returns: Enrollment[] (with subject + teacher data)
```

### Get Subject's Enrollments

```typescript
const enrollments = await enrollmentService.getSubjectEnrollments("subject-id");
// Returns: Enrollment[] (with student data)
```

### Enroll Student

```typescript
try {
  const enrollment = await enrollmentService.create({
    student_id: "student-id",
    subject_id: "subject-id",
    status: "active",
    expires_at: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
} catch (error) {
  // "Student is already enrolled in this subject"
}
```

### Bulk Enroll Students

```typescript
const enrollments = await enrollmentService.bulkEnroll(
  ["student-1", "student-2", "student-3"],
  "subject-id",
);
// Returns: Enrollment[]
```

### Get Enrollment Count

```typescript
const count = await enrollmentService.getEnrollmentCount("subject-id");
// Returns: number
```

## Error Handling

All services throw errors on failure:

```typescript
try {
  await enrollmentService.create({
    student_id: "id",
    subject_id: "id",
  });
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("Enrollment failed:", message);
}
```

## Common Patterns

### Get Student's Active Courses

```typescript
const student = await studentService.getByUserId(userId);
if (!student) return [];

const enrollments = await enrollmentService.getStudentEnrollments(student.id);
// enrollments have subject data included
return enrollments;
```

### Check Course Access

```typescript
const enrolled = await enrollmentService.isEnrolled(studentId, subjectId);

if (!enrolled) {
  throw new Error("Not enrolled in this course");
}

const subject = await subjectService.getById(subjectId);
// Allow access
```

### Get Course for Test

```typescript
const test = await testService.getById(testId);
const subject = test.subject;
const teacher = test.teacher;
```

### Student Dashboard

```typescript
const student = await studentService.getByUserId(userId);
const enrollments = await enrollmentService.getStudentEnrollments(student.id);
// enrollments[].subject contains course data
// enrollments[].subject.teacher contains teacher data
```

### Teacher Dashboard

```typescript
const teacher = await teacherService.getByUserId(userId);
const subjects = await subjectService.listByTeacher(teacher.id);

for (const subject of subjects) {
  const enrollments = await enrollmentService.getSubjectEnrollments(subject.id);
  const enrollmentCount = enrollments.length;

  const tests = await testService.listByTeacher(teacher.id);
  // Dashboard data ready
}
```

## Performance Tips

### ✅ Good

```typescript
// Single query with relations
const data = await supabase
  .from("students")
  .select("*, enrollments(*, subjects(*))")
  .eq("user_id", userId);
```

### ❌ Avoid

```typescript
// Multiple separate queries
const student = await getStudent(userId);
const enrollments = await getEnrollments(student.id);
for (let enrollment of enrollments) {
  const subject = await getSubject(enrollment.subject_id);
}
```

## Type Safety

All services are fully typed:

```typescript
// Autocomplete works
const student = await studentService.getByUserId(userId);
student.board; // ✅ autocomplete
student.invalid; // ❌ type error
```

## Next Steps for Phase 2

1. Update `src/lib/auth.ts` to use database for login
2. Update `src/lib/session.tsx` to sync with database
3. Replace mock data calls with service calls in components
4. Test each route with database queries
5. Deploy to production

---

**Created**: Phase 1  
**Updated**: Ready for Phase 2
