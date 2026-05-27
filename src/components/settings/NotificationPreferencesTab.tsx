import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { getNotificationPreferences, updateNotificationPreference, NotificationPreference } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, string> = {
  session_conflict: "🔐",
  agotado_new: "📦",
  transfer_new: "⇄",
  promo_sap_sync: "✅",
  promo_sap_error: "🚨",
  plan_activated: "📋",
  marketing_kit: "🎨",
};

export function NotificationPreferencesTab() {
  const queryClient = useQueryClient();

  const { data: preferences = [], isLoading, isError } = useQuery<NotificationPreference[]>({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: ({ type, enabled }: { type: string; enabled: boolean }) =>
      updateNotificationPreference(type, enabled),
    onMutate: async ({ type, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ["notification-preferences"] });
      const previous = queryClient.getQueryData<NotificationPreference[]>(["notification-preferences"]);
      queryClient.setQueryData<NotificationPreference[]>(["notification-preferences"], (old = []) =>
        old.map((p) => (p.notification_type === type ? { ...p, enabled } : p)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["notification-preferences"], ctx.previous);
      }
      toast({ title: "Error al guardar preferencia", variant: "destructive" });
    },
    onSuccess: (_data, { enabled, type }) => {
      const pref = preferences.find((p) => p.notification_type === type);
      toast({
        title: enabled
          ? `Notificación activada: ${pref?.label ?? type}`
          : `Notificación desactivada: ${pref?.label ?? type}`,
      });
      queryClient.invalidateQueries({ queryKey: ["header-notifications"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <BellOff className="size-4 shrink-0" />
        No se pudieron cargar las preferencias de notificaciones.
      </div>
    );
  }

  if (preferences.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
        <Bell className="mb-3 size-10 opacity-30" />
        <p className="text-sm">No hay notificaciones disponibles para tu rol.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {preferences.map((pref) => {
        const isPending =
          mutation.isPending && mutation.variables?.type === pref.notification_type;

        return (
          <div
            key={pref.notification_type}
            className={cn(
              "flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors",
              !pref.enabled && "opacity-60",
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
              {TYPE_ICONS[pref.notification_type] ?? "🔔"}
            </span>
            <div className="min-w-0 flex-1">
              <Label
                htmlFor={`notif-${pref.notification_type}`}
                className="cursor-pointer text-sm font-medium"
              >
                {pref.label}
              </Label>
              <p className="text-xs text-muted-foreground">{pref.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              <Switch
                id={`notif-${pref.notification_type}`}
                checked={pref.enabled}
                disabled={isPending}
                onCheckedChange={(checked) =>
                  mutation.mutate({ type: pref.notification_type, enabled: checked })
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
