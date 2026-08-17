import { createFileRoute } from "@tanstack/react-router";
import { Bell, BookOpen, CreditCard, Radio, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { relative } from "@/lib/format";
import { useUserNotifications } from "@/lib/db/hooks";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

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

const icons = { class: Radio, content: BookOpen, test: Trophy, billing: CreditCard, general: Bell };

function NotificationsPage() {
  const { session } = useSession();
  const { data: notifications = [] } = useUserNotifications(session?.id);
  const [items, setItems] = useState(notifications);

  useEffect(() => {
    setItems(notifications);
  }, [notifications]);

  const markAllRead = async () => {
    setItems((p) => p.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={`${items.filter((n) => !n.read).length} unread`}
        action={
          <Button variant="outline" onClick={markAllRead}>
            Mark all read
          </Button>
        }
      />
      <div className="surface divide-y divide-border">
        {items.map((n) => {
          const Icon = icons[n.type];
          return (
            <div key={n.id} className={cn("flex gap-3 p-4", !n.read && "bg-primary/[0.03]")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{n.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.message || n.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {relative(n.created_at || n.at || new Date().toISOString())}
                </p>
              </div>
              {!n.read ? <span className="mt-2 size-2 shrink-0 rounded-full bg-live" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
