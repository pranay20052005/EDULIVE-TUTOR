import type { LucideIcon } from "lucide-react";
import { AlertTriangle, FileCheck, FileText, FileUp, Loader2, Upload, X } from "lucide-react";
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
 * Real File Upload Component with Browse Files & Storage Integration
 * ------------------------------------------------------------------ */

export function FileUploadField({
  id,
  label,
  selectedFile,
  existingUrl,
  existingName,
  onFileSelect,
  isUploading = false,
  error,
  accept = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt",
  hint,
  maxSizeMB = 50,
}: {
  id: string;
  label: string;
  selectedFile: File | null;
  existingUrl?: string | undefined;
  existingName?: string | undefined;
  onFileSelect: (file: File | null) => void;
  isUploading?: boolean;
  error?: string | undefined;
  accept?: string | undefined;
  hint?: string | undefined;
  maxSizeMB?: number;
}) {
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFile = (file: File | undefined | null) => {
    setLocalError(null);
    if (!file) {
      onFileSelect(null);
      return;
    }

    const dangerousExts = [
      ".exe",
      ".bat",
      ".cmd",
      ".sh",
      ".php",
      ".py",
      ".js",
      ".vbs",
      ".msi",
      ".jar",
    ];
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    if (dangerousExts.includes(ext)) {
      setLocalError("Executable files are not allowed for security reasons.");
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setLocalError(`File size exceeds the maximum limit of ${maxSizeMB}MB.`);
      return;
    }

    onFileSelect(file);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const displayError = error || localError;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>

      {selectedFile ? (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
              <FileCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isUploading}
            onClick={() => handleFile(null)}
            className="text-muted-foreground hover:text-destructive shrink-0"
          >
            <X className="size-4 mr-1" /> Remove
          </Button>
        </div>
      ) : existingUrl ? (
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {existingName || "Current attached file"}
              </p>
              <a
                href={existingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                View / download current file
              </a>
            </div>
          </div>
          <label className="cursor-pointer shrink-0">
            <span className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted">
              Replace file
            </span>
            <input
              id={id}
              type="file"
              className="sr-only"
              accept={accept}
              disabled={isUploading}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        </div>
      ) : (
        <div
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <FileUp className="size-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Drag and drop file here, or click Browse</p>
            <p className="text-xs text-muted-foreground">
              Supports PDF, DOC, DOCX, PPT, XLS, images & text up to {maxSizeMB}MB
            </p>
          </div>
          <label className="cursor-pointer mt-1">
            <span className="inline-flex h-9 items-center gap-2 rounded-md bg-secondary px-4 text-xs font-medium text-secondary-foreground shadow-xs hover:bg-secondary/80">
              <Upload className="size-3.5" /> Browse Files
            </span>
            <input
              id={id}
              type="file"
              className="sr-only"
              accept={accept}
              disabled={isUploading}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        </div>
      )}

      {isUploading ? (
        <div className="flex items-center gap-2 text-xs text-primary pt-1">
          <Loader2 className="size-3.5 animate-spin" /> Uploading to Supabase Storage…
        </div>
      ) : null}

      {displayError ? <p className="text-xs text-destructive">{displayError}</p> : null}
      {!displayError && hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/* Backwards-compatible alias */
export const FileField = FileUploadField;

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
