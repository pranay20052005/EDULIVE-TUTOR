import { createFileRoute } from "@tanstack/react-router";
import { Bell, BookOpen, CheckCheck, CreditCard, Radio, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { EmptyState, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { notificationService } from "@/lib/db";
import { useUserNotifications } from "@/lib/db/hooks";
import { useNotificationRealtime } from "@/lib/db/realtime";
import { relative } from "@/lib/format";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/lib/db/types";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — EduLive" },
      {
        name: "description",
        content: "Class reminders, new notes, test alerts and enrollment updates.",
      },
      { property: "og:title", content: "Notifications — EduLive" },
      { property: "og:description", content: "Never miss a live class or new upload." },
    ],
  }),
  component: NotificationsPage,
});

const icons = {
  class: Radio,
  content: BookOpen,
  test: Trophy,
  billing: CreditCard,
  general: Bell,
};

function NotificationsPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();

  // Listen to realtime notifications for the current user
  useNotificationRealtime(session?.id);

  const { data: notifications = [] } = useUserNotifications(session?.id);

  const unreadCount = notifications.filter((n: NotificationItem) => !n.read).length;

  const markAllRead = async () => {
    if (!session?.id) return;
    try {
      await notificationService.markAllAsRead(session.id);
      queryClient.invalidateQueries({ queryKey: ["notifications", session.id] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications-count", session.id] });
      toast.success("All notifications marked as read");
    } catch (err: any) {
      toast.error(err.message || "Failed to update notifications");
    }
  };

  const markSingleRead = async (n: NotificationItem) => {
    if (n.read) return;
    try {
      await notificationService.markAsRead(n.id);
      queryClient.invalidateQueries({ queryKey: ["notifications", session?.id] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications-count", session?.id] });
    } catch (err: any) {
      console.error("Failed to mark notification read:", err);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
            : "All caught up"
        }
        action={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="size-4 mr-1.5" /> Mark all read
            </Button>
          ) : null
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          body="You will receive alerts here when live classes are scheduled, tests are published, or new notes are uploaded."
        />
      ) : (
        <div className="surface divide-y divide-border overflow-hidden">
          {notifications.map((n: NotificationItem) => {
            const Icon = icons[n.type] || Bell;
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => markSingleRead(n)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    markSingleRead(n);
                  }
                }}
                className={cn(
                  "flex gap-3.5 p-4 text-left transition-colors cursor-pointer hover:bg-muted/40",
                  !n.read && "bg-primary/[0.04] dark:bg-primary/[0.08]",
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {n.message || n.body}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {relative(n.created_at || n.at || new Date().toISOString())}
                  </p>
                </div>
                {!n.read ? (
                  <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" title="Unread" />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
