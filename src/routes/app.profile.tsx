import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Compass } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionTitle } from "@/components/ui-kit";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fromDDMMYYYY, initials, maskDOB, toDDMMYYYY } from "@/lib/format";
import { useStudentEnrollments } from "@/lib/db/hooks";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/app/profile")({
  head: () => ({
    meta: [
      { title: "My profile — EduLive" },
      {
        name: "description",
        content: "Your EduLive student profile, account settings and enrolled subjects.",
      },
      { property: "og:title", content: "My profile — EduLive" },
      { property: "og:description", content: "Manage your student profile details." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { student, updateStudent } = useSession();
  const { data: enrollments = [] } = useStudentEnrollments(student?.id);
  const [dob, setDob] = useState(toDDMMYYYY(student.dob));
  const [prefs, setPrefs] = useState({ classes: true, results: true, offers: false });

  const dobValid = dob === "" || fromDDMMYYYY(dob) !== "";

  return (
    <div className="space-y-6">
      <PageHeader title="My profile" subtitle="Keep your details up to date" />

      <div className="surface flex items-center gap-4 bg-gradient-to-br from-primary/5 to-transparent p-5">
        <Avatar className="size-16">
          <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
            {initials(student.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{student.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            Student · {student.standard} Standard · {student.board}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Date of birth: {toDDMMYYYY(student.dob) || "—"}
          </p>
        </div>
      </div>

      <section id="edit-profile" className="surface scroll-mt-24 p-5">
        <SectionTitle title="Edit profile" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Row
            label="Full name"
            value={student.name}
            onChange={(v) => updateStudent({ name: v })}
          />
          <Row label="Email" value={student.email} onChange={(v) => updateStudent({ email: v })} />
          <Row label="Mobile" value={student.phone} onChange={(v) => updateStudent({ phone: v })} />
          <div className="space-y-1.5">
            <Label>Date of birth (DD/MM/YYYY)</Label>
            <Input
              value={dob}
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              onChange={(e) => {
                const masked = maskDOB(e.target.value);
                setDob(masked);
                const iso = fromDDMMYYYY(masked);
                if (iso) updateStudent({ dob: iso });
              }}
            />
            {!dobValid ? (
              <p className="text-xs text-destructive">Enter a valid date as DD/MM/YYYY.</p>
            ) : null}
          </div>
          <Row
            label="Parent / guardian"
            value={student.parentName ?? ""}
            onChange={(v) => updateStudent({ parentName: v })}
          />
          <Row
            label="Parent phone"
            value={student.parentPhone ?? ""}
            onChange={(v) => updateStudent({ parentPhone: v })}
          />
        </div>
        <Button className="mt-5" onClick={() => toast.success("Profile updated")}>
          Save changes
        </Button>
      </section>

      <section id="account-settings" className="surface scroll-mt-24 p-5">
        <SectionTitle title="Account settings" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Detail label="Board" value={student.board || "—"} />
          <Detail
            label="Standard"
            value={student.standard ? `${student.standard} Standard` : "—"}
          />
          <Detail label="Student ID" value={student.id.toUpperCase()} />
          <Detail label="Enrolled courses" value={String(enrollments.length)} />
        </div>
      </section>

      <section id="notification-settings" className="surface scroll-mt-24 p-5">
        <SectionTitle title="Notification settings" />
        <div className="divide-y divide-border">
          {(
            [
              ["classes", "Live class reminders", "Get notified 15 minutes before each class"],
              ["results", "Results & assignments", "Score updates and submission deadlines"],
              ["offers", "Offers & new courses", "Occasional updates about new batches"],
            ] as const
          ).map(([key, title, body]) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{body}</p>
              </div>
              <Switch
                checked={prefs[key]}
                onCheckedChange={(v) => {
                  setPrefs((p) => ({ ...p, [key]: v }));
                  toast.success("Notification preference saved");
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section id="change-password" className="surface scroll-mt-24 p-5">
        <SectionTitle title="Change password" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Current password</Label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input type="password" placeholder="At least 8 characters" />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm new password</Label>
            <Input type="password" placeholder="Repeat new password" />
          </div>
        </div>
        <Button
          className="mt-5"
          variant="outline"
          onClick={() => toast.success("Password updated")}
        >
          Update password
        </Button>
      </section>

      <section className="surface p-5">
        <SectionTitle title="Enrolled subjects" action="Explore courses" to="/app/courses" />
        {enrollments.length ? (
          <div className="flex flex-wrap gap-2">
            {enrollments.map((enrollment: any) => (
              <Badge key={enrollment.id} variant="secondary" className="gap-1.5">
                <BookOpen className="size-3" />
                {enrollment.subject?.name ?? "Subject"}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            You haven&rsquo;t enrolled in any course yet.
            <Button asChild size="sm" variant="outline">
              <Link to="/app/courses">
                <Compass className="size-4" /> Explore courses
              </Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
