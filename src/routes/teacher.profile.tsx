import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionTitle } from "@/components/ui-kit";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { teacherService, userService } from "@/lib/db";
import { supabase } from "@/lib/db/client";
import { initials } from "@/lib/format";
import { useTeacherSubjects } from "@/lib/db/hooks";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/teacher/profile")({
  head: () => ({
    meta: [
      { title: "My profile — EduLive Faculty" },
      {
        name: "description",
        content: "Your EduLive faculty profile, account settings and notification preferences.",
      },
      { property: "og:title", content: "My profile — EduLive Faculty" },
      { property: "og:description", content: "Manage your faculty profile details." },
    ],
  }),
  component: TeacherProfilePage,
});

function TeacherProfilePage() {
  const { session, teacher } = useSession();
  const { data: subjects = [] } = useTeacherSubjects(teacher.id);
  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "Subject";

  const [form, setForm] = useState({
    name: teacher.name,
    phone: teacher.phone,
    qualification: teacher.qualification,
    experienceYears: String(teacher.experienceYears),
    bio: teacher.bio,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prefs, setPrefs] = useState({ classes: true, submissions: true, announcements: false });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next["name"] = "Name is required.";
    if (!/^[+\d][\d\s+-]{7,}$/.test(form.phone.trim()))
      next["phone"] = "Enter a valid phone number.";
    if (!form.qualification.trim()) next["qualification"] = "Qualification is required.";
    const exp = Number(form.experienceYears);
    if (!Number.isFinite(exp) || exp < 0 || exp > 60)
      next["experienceYears"] = "Enter a valid number of years.";
    if (!form.bio.trim()) next["bio"] = "A short bio helps students know you.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveProfile = async () => {
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSavingProfile(true);
    try {
      if (teacher.id) {
        await teacherService.update(teacher.id, {
          qualification: form.qualification.trim(),
          experience_years: Number(form.experienceYears) || 0,
          bio: form.bio.trim(),
        });
      }
      const userUid = session?.userId || session?.id || teacher?.userId;
      if (userUid) {
        await userService.updateProfile(userUid, {
          name: form.name.trim(),
          phone: form.phone.trim(),
        });
      }
      toast.success("Profile updated successfully");
    } catch (err: any) {
      console.error("Failed to update profile:", err);
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const validatePwd = () => {
    const next: Record<string, string> = {};
    if (pwd.next.length < 8) next["next"] = "New password must be at least 8 characters.";
    if (pwd.confirm !== pwd.next || !pwd.confirm) next["confirm"] = "Passwords do not match.";
    setPwdErrors(next);
    return Object.keys(next).length === 0;
  };

  const changePassword = async () => {
    if (!validatePwd()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: pwd.next,
      });
      if (error) throw error;
      toast.success("Password updated successfully");
      setPwd({ current: "", next: "", confirm: "" });
      setPwdErrors({});
    } catch (err: any) {
      console.error("Failed to update password:", err);
      toast.error(err.message || "Failed to update password");
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My profile" subtitle="Your faculty profile and account preferences" />

      <div className="surface flex items-center gap-4 bg-gradient-to-br from-primary/5 to-transparent p-5">
        <Avatar className="size-16">
          <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
            {initials(teacher.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{teacher.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            Faculty · {teacher.qualification}
          </p>
          <p className="truncate text-xs text-muted-foreground">{teacher.email}</p>
        </div>
      </div>

      <section id="edit-profile" className="surface scroll-mt-24 p-5">
        <SectionTitle title="Edit profile" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            value={form.name}
            onChange={set("name")}
            error={errors["name"]}
          />
          <Field label="Phone" value={form.phone} onChange={set("phone")} error={errors["phone"]} />
          <Field
            label="Qualification"
            value={form.qualification}
            onChange={set("qualification")}
            error={errors["qualification"]}
          />
          <Field
            label="Experience (years)"
            value={form.experienceYears}
            onChange={set("experienceYears")}
            error={errors["experienceYears"]}
            inputMode="numeric"
          />
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Bio</Label>
            <Textarea value={form.bio} rows={3} onChange={(e) => set("bio")(e.target.value)} />
            {errors["bio"] ? <p className="text-xs text-destructive">{errors["bio"]}</p> : null}
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <Label className="text-xs text-muted-foreground">Subjects taught</Label>
          <div className="flex flex-wrap gap-2">
            {teacher.subjectIds.map((id) => (
              <Badge key={id} variant="secondary" className="gap-1.5">
                <BookOpen className="size-3" />
                {subjectName(id)}
              </Badge>
            ))}
          </div>
        </div>

        <Button className="mt-5" onClick={saveProfile} disabled={savingProfile}>
          {savingProfile ? "Saving…" : "Save changes"}
        </Button>
      </section>

      <section id="account-settings" className="surface scroll-mt-24 p-5">
        <SectionTitle title="Account settings" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Detail label="Email" value={teacher.email} />
          <Detail label="Faculty ID" value={teacher.id.toUpperCase()} />
          <Detail label="Standards taught" value={teacher.standards.join(", ")} />
          <Detail label="Subjects" value={String(teacher.subjectIds.length)} />
        </div>
      </section>

      <section id="notification-settings" className="surface scroll-mt-24 p-5">
        <SectionTitle title="Notification settings" />
        <div className="divide-y divide-border">
          {(
            [
              ["classes", "Live class reminders", "Get notified 15 minutes before your classes"],
              ["submissions", "New submissions", "Alerts when a student submits an assignment"],
              ["announcements", "Institute announcements", "Updates from EduLive administration"],
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
            <Input
              type="password"
              value={pwd.current}
              onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))}
              placeholder="••••••••"
            />
            {pwdErrors["current"] ? (
              <p className="text-xs text-destructive">{pwdErrors["current"]}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input
              type="password"
              value={pwd.next}
              onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))}
              placeholder="At least 8 characters"
            />
            {pwdErrors["next"] ? (
              <p className="text-xs text-destructive">{pwdErrors["next"]}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Confirm new password</Label>
            <Input
              type="password"
              value={pwd.confirm}
              onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
              placeholder="Repeat new password"
            />
            {pwdErrors["confirm"] ? (
              <p className="text-xs text-destructive">{pwdErrors["confirm"]}</p>
            ) : null}
          </div>
        </div>
        <Button className="mt-5" variant="outline" onClick={changePassword} disabled={savingPwd}>
          {savingPwd ? "Updating…" : "Update password"}
        </Button>
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

function Field({
  label,
  value,
  onChange,
  error,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  inputMode?: "numeric" | undefined;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
