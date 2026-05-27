import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  BellOff,
  CheckCircle2,
  Layers,
  Loader2,
  LogIn,
  Megaphone,
  Package,
  XCircle,
} from "lucide-react";
import { getNotificationPreferences, updateNotificationPreference, NotificationPreference } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface NotifMeta {
  icon: React.ElementType;
  iconClass: string;
  badgeLabel: string;
  badgeClass: string;
}

const TYPE_META: Record<string, NotifMeta> = {
  session_conflict: {
    icon: LogIn,
    iconClass: "text-amber-500",
    badgeLabel: "Seguridad",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  agotado_new: {
    icon: Package,
    iconClass: "text-orange-500",
    badgeLabel: "Inventario",
    badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  transfer_new: {
    icon: ArrowRightLeft,
    iconClass: "text-blue-500",
    badgeLabel: "Transferencias",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  promo_sap_sync: {
    icon: CheckCircle2,
    iconClass: "text-green-500",
    badgeLabel: "SAP",
    badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  promo_sap_error: {
    icon: XCircle,
    iconClass: "text-destructive",
    badgeLabel: "SAP",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  plan_activated: {
    icon: Layers,
    iconClass: "text-primary",
    badgeLabel: "Planes",
    badgeClass: "bg-primary/10 text-primary dark:bg-primary/20",
  },
  marketing_kit: {
    icon: Megaphone,
    iconClass: "text-purple-500",
    badgeLabel: "Marketing",
    badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
};

function PreferenceSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b p-4 last:border-0">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
    </div>
  );
}

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
      if (ctx?.previous) queryClient.setQueryData(["notification-preferences"], ctx.previous);
      toast({ title: "Error al guardar preferencia", variant: "destructive" });
    },
    onSuccess: (_data, { enabled, type }) => {
      const pref = preferences.find((p) => p.notification_type === type);
      toast({ title: enabled ? `Activado: ${pref?.label ?? type}` : `Desactivado: ${pref?.label ?? type}` });
      queryClient.invalidateQueries({ queryKey: ["header-notifications"] });
    },
  });

  const enabledCount = preferences.filter((p) => p.enabled).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-primary" />
              Avisos en la campanita
            </CardTitle>
            <CardDescription className="mt-1">
              Activa o desactiva cada tipo de notificación según lo que quieres ver.
            </CardDescription>
          </div>
          {!isLoading && !isError && preferences.length > 0 && (
            <Badge variant="outline" className="w-fit shrink-0 self-start text-xs">
              {enabledCount}/{preferences.length} activos
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="divide-y">
            {[1, 2, 3, 4, 5].map((i) => <PreferenceSkeleton key={i} />)}
          </div>
        ) : isError ? (
          <div className="flex items-center gap-3 p-6 text-sm text-destructive">
            <BellOff className="size-4 shrink-0" />
            No se pudieron cargar las preferencias. Recarga la página.
          </div>
        ) : preferences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <BellOff className="mb-3 size-10 opacity-30" />
            <p className="text-sm">No hay notificaciones disponibles para tu rol.</p>
          </div>
        ) : (
          <div className="divide-y">
            {preferences.map((pref) => {
              const meta = TYPE_META[pref.notification_type];
              const Icon = meta?.icon ?? AlertTriangle;
              const isPending = mutation.isPending && mutation.variables?.type === pref.notification_type;

              return (
                <div
                  key={pref.notification_type}
                  className={cn(
                    "flex items-center gap-3 px-6 py-4 transition-colors sm:gap-4",
                    !pref.enabled && "opacity-50",
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full bg-muted",
                    !pref.enabled && "opacity-60",
                  )}>
                    <Icon className={cn("size-5", meta?.iconClass ?? "text-muted-foreground")} />
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label
                        htmlFor={`notif-${pref.notification_type}`}
                        className="cursor-pointer text-sm font-medium leading-snug"
                      >
                        {pref.label}
                      </Label>
                      {meta?.badgeLabel && (
                        <span className={cn(
                          "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold",
                          meta.badgeClass,
                        )}>
                          {meta.badgeLabel}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {pref.description}
                    </p>
                  </div>

                  {/* Toggle */}
                  <div className="flex shrink-0 items-center gap-2">
                    {isPending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
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
        )}
      </CardContent>
    </Card>
  );
}
