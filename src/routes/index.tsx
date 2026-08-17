import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardList,
  FileText,
  GraduationCap,
  PlaySquare,
  Radio,
  Star,
} from "lucide-react";

import heroImage from "@/assets/hero-student.jpg";
import { LiveBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { useAllSubscriptionPlans } from "@/lib/db/hooks";
import type { SubscriptionPlan } from "@/lib/db/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduLive — Live Online Tuition for Class 6 to 12" },
      {
        name: "description",
        content:
          "EduLive runs daily live classes with expert faculty, plus recordings, notes, assignments, mock tests and parent-ready progress reports.",
      },
      { property: "og:title", content: "EduLive — Live Online Tuition for Class 6 to 12" },
      {
        property: "og:description",
        content:
          "Daily live classes, recordings, notes, assignments and mock tests for CBSE, ICSE and State Board students.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Radio,
    title: "Daily live classes",
    body: "Interactive sessions with whiteboard, screen share, raise-hand and live chat.",
  },
  {
    icon: PlaySquare,
    title: "Every class recorded",
    body: "Miss a session or want a revision? Resume exactly where you left off.",
  },
  {
    icon: FileText,
    title: "Notes & worksheets",
    body: "Chapter-wise PDFs, homework and reference material curated by faculty.",
  },
  {
    icon: ClipboardList,
    title: "Assignments",
    body: "Submit online, get reviewed marks and teacher remarks in one place.",
  },
  {
    icon: Star,
    title: "Mock tests",
    body: "Timed MCQ exams with instant evaluation and full answer keys.",
  },
  {
    icon: BarChart3,
    title: "Progress tracking",
    body: "Attendance, subject progress and score trends for students and parents.",
  },
];

function Landing() {
  const { data: plans = [] } = useAllSubscriptionPlans();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            <span className="truncate font-display text-lg font-semibold">EduLive</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Enroll now</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
        <div>
          <LiveBadge label="LIVE CLASSES RUNNING NOW" />
          <h1 className="mt-4 text-3xl leading-[1.1] font-semibold sm:text-5xl">
            Live tuition for Class 6–12, run like a real classroom.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            EduLive brings your teacher, whiteboard, notes, assignments and tests into one calm
            workspace. Attend live, revise from recordings, and track every mark.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/register">Start enrolling</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">View demo dashboard</Link>
            </Button>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6">
            {[
              ["12,400+", "Students learning"],
              ["180+", "Live classes weekly"],
              ["94%", "Board pass distinction"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="text-xl font-semibold sm:text-2xl">{v}</dt>
                <dd className="text-xs text-muted-foreground sm:text-sm">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative">
          <img
            src={heroImage}
            alt="Student attending an EduLive live class on a laptop"
            width={1280}
            height={960}
            className="w-full rounded-3xl border border-border object-cover shadow-[var(--shadow-lift)]"
          />
        </div>
      </section>

      <section className="border-y border-border bg-card/60 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold sm:text-3xl">Everything a serious student needs</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="surface p-5">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold sm:text-3xl">Flexible plans</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay per subject, take a package, or subscribe monthly, quarterly or annually.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.slice(0, 3).map((p: SubscriptionPlan, i: number) => (
            <div
              key={p.id}
              className={
                i === 1 ? "surface border-primary/40 p-6 ring-1 ring-primary/20" : "surface p-6"
              }
            >
              <p className="text-sm font-medium text-muted-foreground">{p.name}</p>
              <p className="mt-3 text-3xl font-semibold">{inr(p.price_inr)}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {p.billing_cycle || "monthly"}
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {(
                  p.features || [
                    "All live classes & recordings",
                    "Chapter notes & worksheets",
                    "Assignments & teacher remarks",
                    "Mock tests & performance reports",
                  ]
                ).map((inc: string) => (
                  <li key={inc} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-accent" />
                    {inc}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full" variant={i === 1 ? "default" : "outline"}>
                <Link to="/register">Choose plan</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} EduLive Academy. All rights reserved.</p>
          <p>Hyderabad · Bengaluru · Online</p>
        </div>
      </footer>
    </div>
  );
}
