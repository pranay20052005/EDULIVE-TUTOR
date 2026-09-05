import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { PageHeader, SectionTitle } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { settingsService, defaultSettings, type InstituteSettings } from "@/lib/db";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — EduLive Admin" },
      {
        name: "description",
        content: "Institute settings, notification preferences and role permissions.",
      },
      { property: "og:title", content: "Settings — EduLive Admin" },
      { property: "og:description", content: "Configure institute-wide EduLive settings." },
    ],
  }),
  component: AdminSettings,
});

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Karachi", "Asia/Dhaka"];
const ACADEMIC_YEARS = ["2023-24", "2024-25", "2025-26", "2026-27"];

const permissions = [
  {
    role: "Administrator",
    access: "Full platform access — students, faculty, subjects, billing and reports.",
  },
  {
    role: "Faculty",
    access: "Manage own subjects — notes, tests, assignments, live classes and attendance.",
  },
  {
    role: "Student",
    access: "View enrolled subjects, attend classes, submit work and track results.",
  },
];

function AdminSettings() {
  const queryClient = useQueryClient();
  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => settingsService.getAll(),
  });

  const [form, setForm] = useState<InstituteSettings>(defaultSettings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dbSettings) {
      setForm(dbSettings);
    }
  }, [dbSettings]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.instituteName.trim()) next["instituteName"] = "Institute name is required.";
    if (!/^\S+@\S+\.\S+$/.test(form.contactEmail.trim()))
      next["contactEmail"] = "Enter a valid email address.";
    if (!/^[+\d][\d\s+-]{7,}$/.test(form.contactPhone.trim()))
      next["contactPhone"] = "Enter a valid phone number.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSaving(true);
    try {
      await settingsService.save(form);
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      toast.success("Institute settings saved successfully!");
    } catch (err: any) {
      console.error("Save settings error:", err);
      toast.error(err.message || "Failed to save settings to database");
    } finally {
      setSaving(false);
    }
  };

  const updateToggle = async (key: keyof InstituteSettings, value: boolean) => {
    const nextForm = { ...form, [key]: value };
    setForm(nextForm);
    try {
      await settingsService.save({ [key]: value });
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      toast.success("Notification preference saved");
    } catch (err: any) {
      toast.error("Failed to update preference: " + err.message);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Institute settings"
        subtitle="Configure your institute's platform-wide preferences"
      />

      <section className="surface p-5">
        <SectionTitle title="Institute details" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Institute name</Label>
            <Input
              value={form.instituteName}
              onChange={(e) => setForm((p) => ({ ...p, instituteName: e.target.value }))}
              placeholder="e.g. EduLive Learning Academy"
            />
            {errors["instituteName"] ? (
              <p className="text-xs text-destructive">{errors["instituteName"]}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Contact email</Label>
            <Input
              value={form.contactEmail}
              onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
              placeholder="support@edulive.in"
            />
            {errors["contactEmail"] ? (
              <p className="text-xs text-destructive">{errors["contactEmail"]}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Contact phone</Label>
            <Input
              value={form.contactPhone}
              onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value }))}
              placeholder="+91 98765 43210"
            />
            {errors["contactPhone"] ? (
              <p className="text-xs text-destructive">{errors["contactPhone"]}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Academic year</Label>
            <Select
              value={form.academicYear}
              onValueChange={(v) => setForm((p) => ({ ...p, academicYear: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACADEMIC_YEARS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select
              value={form.timezone}
              onValueChange={(v) => setForm((p) => ({ ...p, timezone: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="mt-5" onClick={save} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="size-3.5 mr-1.5 animate-spin" /> Saving…
            </>
          ) : (
            "Save settings"
          )}
        </Button>
      </section>

      <section className="surface p-5">
        <SectionTitle title="Notification settings" />
        <div className="divide-y divide-border">
          {(
            [
              ["paymentAlerts", "Payment alerts", "Notify admins when a payment succeeds or fails"],
              ["lowAttendance", "Low attendance alerts", "Flag subjects with attendance below 75%"],
              ["newEnrollments", "New enrollments", "Notify when a student enrolls in a subject"],
              ["marketing", "Marketing updates", "Product updates and platform announcements"],
            ] as const
          ).map(([key, title, body]) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{body}</p>
              </div>
              <Switch checked={Boolean(form[key])} onCheckedChange={(v) => updateToggle(key, v)} />
            </div>
          ))}
        </div>
      </section>

      <section className="surface p-5">
        <SectionTitle title="Roles & permissions" />
        <div className="space-y-3">
          {permissions.map((p) => (
            <div
              key={p.role}
              className="flex items-start justify-between gap-4 rounded-xl bg-muted/60 p-3.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{p.access}</p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {p.role}
              </Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
