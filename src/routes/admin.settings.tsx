import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

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
const ACADEMIC_YEARS = ["2023-24", "2024-25", "2025-26"];

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
  const [form, setForm] = useState({
    instituteName: "EduLive Learning Pvt. Ltd.",
    contactEmail: "support@edulive.in",
    contactPhone: "+91 80000 12345",
    academicYear: ACADEMIC_YEARS[1]!,
    timezone: TIMEZONES[0]!,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toggles, setToggles] = useState({
    paymentAlerts: true,
    lowAttendance: true,
    newEnrollments: true,
    marketing: false,
  });

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

  const save = () => {
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    toast.success("Settings saved");
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
        <Button className="mt-5" onClick={save}>
          Save settings
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
              <Switch
                checked={toggles[key]}
                onCheckedChange={(v) => {
                  setToggles((p) => ({ ...p, [key]: v }));
                  toast.success("Notification preference saved");
                }}
              />
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
