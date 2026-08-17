/**
 * Database Services Index
 * Centralized exports for all database services
 */

export * from "./client";
export * from "./types";

// Service exports
export * from "./services/users";
export * from "./services/students";
export * from "./services/teachers";
export * from "./services/subjects";
export * from "./services/tests";
export * from "./services/enrollments";
export * from "./services/chapters";
export * from "./services/materials";
export * from "./services/assignments";
export * from "./services/scheduled-classes";
export * from "./services/attendance";
export * from "./services/recordings";
export * from "./services/question-papers";
export * from "./services/test-attempts";
export * from "./services/test-answers";
export * from "./services/assignment-submissions";
export * from "./services/notifications";
export * from "./services/announcements";
export * from "./services/payments";
export * from "./services/subscription-plans";

// Aliases for compatibility
export { subscriptionPlanService as subscriptionPlansService } from "./services/subscription-plans";
