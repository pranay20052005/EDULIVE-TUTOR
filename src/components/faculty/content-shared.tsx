import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { useState, type ReactNode } from "react";

import { CardSkeleton, EmptyState } from "@/components/ui-kit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import type { PublishStatus, Subject } from "@/lib/db/types";

/* ------------------------------------------------------------------ *
 * Loading / error / empty wrappers
 * ------------------------------------------------------------------ */

export function ContentLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: rows }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ContentError({ message }: { message: string }) {
  return <EmptyState icon={AlertTriangle} title="Something went wrong" body={message} />;
}

export function ContentEmpty({
  icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return <EmptyState icon={icon} title={title} body={body} action={action} />;
}

/* ------------------------------------------------------------------ *
 * Subject picker
 * ------------------------------------------------------------------ */

export function SubjectPicker({
  subjects,
  value,
  onChange,
  placeholder = "Select subject",
  includeAll = false,
  id,
}: {
  subjects: Subject[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  includeAll?: boolean;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAll ? <SelectItem value="all">All subjects</SelectItem> : null}
        {subjects.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name} · {s.standard}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ------------------------------------------------------------------ *
 * Status badge + toggle
 * ------------------------------------------------------------------ */

export function StatusBadge({
  status,
}: {
  status: PublishStatus | "live" | "upcoming" | "completed" | "scheduled";
}) {
  return (
    <Badge
      variant={status === "published" ? "default" : "secondary"}
      className="shrink-0 capitalize"
    >
      {status}
    </Badge>
  );
}

export function PublishToggle({
  status,
  onChange,
  disabled,
}: {
  status: PublishStatus | "live" | "upcoming" | "completed" | "scheduled";
  onChange: (next: PublishStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={status === "published"}
        disabled={disabled}
        onCheckedChange={(checked) => onChange(checked ? "published" : "draft")}
        aria-label={status === "published" ? "Unpublish" : "Publish"}
      />
      <span className="text-xs text-muted-foreground">
        {status === "published" ? "Published" : "Draft"}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Upload-style file field — stores only a filename (no real upload).
 * ------------------------------------------------------------------ */

export function FileField({
  id,
  label,
  value,
  onChange,
  error,
  accept,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  accept?: string | undefined;
  hint?: string | undefined;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div
        className={`flex flex-col gap-2 rounded-xl border border-dashed p-3 transition-colors sm:flex-row sm:items-center ${
          dragging ? "border-primary bg-primary/5" : "border-input"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onChange(file.name);
        }}
      >
        <Input
          id={id}
          type="text"
          placeholder="e.g. chapter-1-notes.pdf"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className="flex-1"
        />
        <label className="cursor-pointer">
          <span className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-muted">
            Browse
          </span>
          <input
            type="file"
            className="sr-only"
            accept={accept}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onChange(file.name);
            }}
          />
        </label>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error && hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Delete confirm dialog
 * ------------------------------------------------------------------ */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  destructive = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ------------------------------------------------------------------ *
 * Small form field helper for inline error text
 * ------------------------------------------------------------------ */

export function FieldError({ error }: { error?: string | undefined }) {
  if (!error) return null;
  return <p className="text-xs text-destructive">{error}</p>;
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2 pt-2">{children}</div>;
}

export function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={onClick}>
      Cancel
    </Button>
  );
}
