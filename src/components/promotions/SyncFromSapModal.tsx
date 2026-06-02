import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshCw, Loader2, AlertCircle, CheckCircle2, Download, ArrowDownToLine,
  AlertTriangle, Info, Clock, WifiOff, ServerCrash, Lock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  startSapPreview, getSapPreviewResult, importSapCampaigns, checkSapHealth, getSapAutoSyncStatus,
  inferSapErrorType,
  SapCampaignPreview, SapImportResult, SapErrorInfo, SapMessage,
} from '@/lib/api';
import { toast } from 'sonner';
import { StepsProgress } from './StepsProgress';

interface SyncFromSapModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  onBusyChange?: (busy: boolean) => void;
}

type ModalState = 'idle' | 'loading' | 'preview' | 'queued' | 'result' | 'error';

const LOADING_STEPS = [
  'Verificando conexión con SAP…',
  'Consultando campañas disponibles…',
  'Preparando vista previa…',
];

const IMPORTING_STEPS = [
  'Validando campañas seleccionadas…',
  'Sincronizando con Ivanagro…',
  'Finalizando importación…',
];

const SAP_ERROR_MAP: Record<
  string,
  { title: string; description: string; Icon: React.ComponentType<{ className?: string }>; isWarning?: boolean }
> = {
  TIMEOUT: {
    title: 'SAP tardó demasiado en responder',
    description: 'El servidor tardó más de 30 segundos. Suele resolverse reintentando.',
    Icon: Clock,
    isWarning: true,
  },
  NETWORK_ERROR: {
    title: 'No se pudo conectar con SAP',
    description: 'Verifica que el servidor SAP esté accesible desde la red.',
    Icon: WifiOff,
  },
  SAP_UNAVAILABLE: {
    title: 'SAP no está disponible',
    description: 'El servidor SAP respondió con un error interno. Intenta en unos minutos.',
    Icon: ServerCrash,
  },
  AUTH_EXPIRED: {
    title: 'Sesión con SAP expirada',
    description: 'La sesión fue renovada automáticamente. Vuelve a intentarlo.',
    Icon: Lock,
    isWarning: true,
  },
  DATA_ERROR: {
    title: 'Error en los datos recibidos',
    description: 'Hubo un problema con el formato de los datos de SAP. Contacta soporte.',
    Icon: AlertCircle,
  },
};

function MessagesBadge({ messages }: { messages: SapMessage[] }) {
  if (messages.length === 0) return <span className="text-muted-foreground">—</span>;
  const hasError = messages.some((m) => m.type === 'error');
  const hasWarning = messages.some((m) => m.type === 'warning');
  const severity = hasError ? 'error' : hasWarning ? 'warning' : 'info';
  const badgeClass = cn(
    'cursor-pointer text-xs font-medium',
    severity === 'error' && 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100',
    severity === 'warning' && 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100',
    severity === 'info' && 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100',
  );
  const label = messages.length === 1
    ? severity === 'error' ? '1 error' : severity === 'warning' ? '1 aviso' : '1 info'
    : `${messages.length} ${severity === 'error' ? 'errores' : severity === 'warning' ? 'avisos' : 'info'}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button"><Badge variant="outline" className={badgeClass}>{label}</Badge></button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <ul className="space-y-2">
          {messages.map((msg, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              {msg.type === 'error' && <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
              {msg.type === 'warning' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />}
              {msg.type === 'info' && <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />}
              <span className={cn(
                msg.type === 'error' && 'text-red-700',
                msg.type === 'warning' && 'text-amber-700',
                msg.type === 'info' && 'text-blue-700',
              )}>{msg.text}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export default function SyncFromSapModal({ open, onClose, onImported, onBusyChange }: SyncFromSapModalProps) {
  const [state, setState] = useState<ModalState>('idle');
  const [campaigns, setCampaigns] = useState<SapCampaignPreview[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [errorInfo, setErrorInfo] = useState<SapErrorInfo | null>(null);
  const [result, setResult] = useState<SapImportResult | null>(null);
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  // Progress state for loading and importing animations
  const [loadStep, setLoadStep] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [importStep, setImportStep] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const importStartTimeRef = useRef<number>(0);
  const previewPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate loading steps
  useEffect(() => {
    if (state !== 'loading') { setLoadStep(0); setLoadProgress(0); return; }
    setLoadStep(0); setLoadProgress(5);
    const stepTimers = [
      window.setTimeout(() => setLoadStep(1), 700),
      window.setTimeout(() => setLoadStep(2), 1600),
    ];
    let p = 5;
    const ticker = setInterval(() => { p = Math.min(p + 1.5, 88); setLoadProgress(Math.round(p)); }, 100);
    return () => { stepTimers.forEach(clearTimeout); clearInterval(ticker); };
  }, [state]);

  // Animate importing steps while queued (real work happens in background)
  useEffect(() => {
    if (state !== 'queued') { setImportStep(0); setImportProgress(0); return; }
    setImportStep(0); setImportProgress(5);
    const stepTimers = [
      window.setTimeout(() => setImportStep(1), 800),
      window.setTimeout(() => setImportStep(2), 1800),
    ];
    let p = 5;
    const ticker = setInterval(() => { p = Math.min(p + 1.2, 90); setImportProgress(Math.round(p)); }, 120);
    return () => { stepTimers.forEach(clearTimeout); clearInterval(ticker); };
  }, [state]);

  // Report busy state independently of open — spinner persists in background
  useEffect(() => {
    onBusyChange?.(state === 'loading' || state === 'queued');
  }, [state, onBusyChange]);

  // Poll /auto-status while in queued state to detect background import completion
  useEffect(() => {
    if (state !== 'queued') return;
    const poll = setInterval(async () => {
      try {
        const status = await getSapAutoSyncStatus();
        if (!status.last_run_at) return;
        const lastRun = new Date(status.last_run_at).getTime();
        if (lastRun >= importStartTimeRef.current && status.status !== 'never_run') {
          clearInterval(poll);
          setResult({
            imported_count: status.imported,
            updated_count: status.updated,
            skipped_count: status.skipped,
            errors: status.errors,
          });
          setState('result');
          onImported();
          if (status.errors.length === 0) {
            toast.success(`Sincronización completa: ${status.imported} creadas, ${status.updated} actualizadas`);
          } else {
            toast.warning(`Sincronización con ${status.errors.length} error(es)`);
          }
        }
      } catch {
        // network hiccup — keep polling
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [state, onImported]);

  const loadPreview = useCallback(async () => {
    setState('loading');
    setErrorInfo(null);
    setErrorsExpanded(false);
    if (previewPollRef.current) { clearInterval(previewPollRef.current); previewPollRef.current = null; }

    const healthPromise = checkSapHealth().catch(() => null);

    try {
      await startSapPreview();
    } catch (err) {
      const health = await healthPromise;
      const info = inferSapErrorType(err);
      setErrorInfo(health?.status === 'unavailable' ? { ...info, error_type: 'NETWORK_ERROR' } : info);
      setState('error');
      return;
    }

    previewPollRef.current = setInterval(async () => {
      try {
        const res = await getSapPreviewResult();
        if (res.status === 'ready') {
          if (previewPollRef.current) { clearInterval(previewPollRef.current); previewPollRef.current = null; }
          const data = res.data ?? [];
          setCampaigns(data);
          setSelected(new Set(data.map((c) => c.campaign_number)));
          setState('preview');
        } else if (res.status === 'failed') {
          if (previewPollRef.current) { clearInterval(previewPollRef.current); previewPollRef.current = null; }
          const health = await healthPromise;
          const message = res.error ?? 'Error en la sincronización con SAP';
          const info = { error_type: 'SAP_UNAVAILABLE' as const, is_retryable: true, message };
          setErrorInfo(health?.status === 'unavailable' ? { ...info, error_type: 'NETWORK_ERROR' as const } : info);
          setState('error');
        }
      } catch { /* network hiccup — keep polling */ }
    }, 10000);
  }, []);

  // Start loading only when opened from idle (not during background op)
  useEffect(() => {
    if (open && state === 'idle') {
      setResult(null);
      loadPreview();
    }
  }, [open, state, loadPreview]);

  // Reset to idle only after final states — loading/preview/queued survive close/reopen
  useEffect(() => {
    if (!open && (state === 'result' || state === 'error')) {
      setState('idle');
    }
  }, [open, state]);

  const allSelected = campaigns.length > 0 && selected.size === campaigns.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(campaigns.map((c) => c.campaign_number)));
  const toggleOne = (n: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(n)) {
      next.delete(n);
    } else {
      next.add(n);
    }
    return next;
  });

  const counts = useMemo(() => {
    let create = 0;
    let update = 0;
    campaigns.forEach((c) => {
      if (!selected.has(c.campaign_number)) return;
      if (c.action === 'create') {
        create += 1;
      } else {
        update += 1;
      }
    });
    return { create, update };
  }, [campaigns, selected]);

  const handleCancel = useCallback(() => {
    if (previewPollRef.current) { clearInterval(previewPollRef.current); previewPollRef.current = null; }
    setState('idle');
    onClose();
  }, [onClose]);

  const handleImport = async () => {
    if (selected.size === 0) { toast.error('Selecciona al menos una campaña'); return; }
    importStartTimeRef.current = Date.now();
    setState('queued');
    try {
      await importSapCampaigns(Array.from(selected));
    } catch (err) {
      setErrorInfo(inferSapErrorType(err));
      setState('error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent forceMount className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sincronizar promociones desde SAP</DialogTitle>
        </DialogHeader>

        {/* ── Loading ── */}
        {state === 'loading' && (
          <div className="py-4">
            <StepsProgress
              steps={LOADING_STEPS}
              step={loadStep}
              progress={loadProgress}
              label={LOADING_STEPS[loadStep]}
            />
          </div>
        )}

        {/* ── Error ── */}
        {state === 'error' && errorInfo && (() => {
          const mapping = SAP_ERROR_MAP[errorInfo.error_type] ?? {
            title: 'Error inesperado',
            description: errorInfo.message,
            Icon: AlertCircle,
            isWarning: false,
          };
          const { title, description, Icon, isWarning } = mapping;
          return (
            <div className="py-6 space-y-4">
              <div className="rounded-lg border bg-muted/20 p-6 flex flex-col items-center gap-3 text-center">
                <div className={cn(
                  'flex size-14 items-center justify-center rounded-full',
                  isWarning ? 'bg-amber-100' : 'bg-red-100',
                )}>
                  <Icon className={cn('h-7 w-7', isWarning ? 'text-amber-500' : 'text-red-500')} />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-base">{title}</p>
                  <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
                </div>
                {errorInfo.message && (
                  <div className="w-full rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive text-center">
                    <span className="font-medium">Error de sincronización SAP: </span>{errorInfo.message}
                  </div>
                )}
                {errorInfo.is_retryable && (
                  <Button variant="outline" onClick={loadPreview} className="gap-2 mt-1">
                    <RefreshCw className="h-4 w-4" /> Reintentar
                  </Button>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Preview ── */}
        {state === 'preview' && (
          <>
            {campaigns.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                No hay campañas vigentes en SAP para sincronizar.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur border-b">
                    <tr>
                      <th className="w-10 p-2">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Seleccionar todo" />
                      </th>
                      <th className="text-left p-2 font-medium">Campaña</th>
                      <th className="text-left p-2 font-medium">Título</th>
                      <th className="text-left p-2 font-medium w-28">Info</th>
                      <th className="text-left p-2 font-medium">Laboratorio</th>
                      <th className="text-left p-2 font-medium">Vigencia</th>
                      <th className="text-left p-2 font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.campaign_number} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-2 text-center">
                          <Checkbox checked={selected.has(c.campaign_number)} onCheckedChange={() => toggleOne(c.campaign_number)} aria-label={`Seleccionar campaña ${c.campaign_number}`} />
                        </td>
                        <td className="p-2 text-muted-foreground font-mono">#{c.campaign_number}</td>
                        <td className="p-2 font-medium">{c.title || '(sin título)'}</td>
                        <td className="p-2"><MessagesBadge messages={c.messages} /></td>
                        <td className="p-2">{c.laboratory_name || <span className="text-amber-600">—</span>}</td>
                        <td className="p-2 text-muted-foreground whitespace-nowrap">{c.start_date} → {c.end_date}</td>
                        <td className="p-2">
                          {c.action === 'create'
                            ? <Badge variant="default" className="bg-green-600 hover:bg-green-600">Nueva</Badge>
                            : <Badge variant="secondary">Actualizar</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t mt-2">
              <div className="text-sm text-muted-foreground">
                {selected.size} seleccionada(s) · {counts.create} nuevas, {counts.update} a actualizar
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
                <Button onClick={handleImport} disabled={selected.size === 0}>
                  <ArrowDownToLine className="h-4 w-4 mr-2" /> Importar seleccionadas
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── Queued (importing in background, shows StepsProgress while polling) ── */}
        {state === 'queued' && (
          <div className="py-4 flex flex-col gap-4">
            <StepsProgress
              steps={IMPORTING_STEPS}
              step={importStep}
              progress={importProgress}
              label={IMPORTING_STEPS[importStep]}
            />
          </div>
        )}

        {/* ── Result ── */}
        {state === 'result' && result && (
          <div className="py-2 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Sincronización completada</p>
                <p className="text-xs text-muted-foreground">Las campañas de SAP han sido procesadas correctamente</p>
              </div>
            </div>

            {/* Stats */}
            <div className="rounded-lg border divide-y">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary/10">
                    <ArrowDownToLine className="size-3.5 text-primary" />
                  </span>
                  <span className="text-sm">Campañas creadas</span>
                </div>
                <span className="text-sm font-semibold tabular-nums">{result.imported_count}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary/10">
                    <RefreshCw className="size-3.5 text-primary" />
                  </span>
                  <span className="text-sm">Campañas actualizadas</span>
                </div>
                <span className="text-sm font-semibold tabular-nums">{result.updated_count}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-md bg-muted">
                    <Download className="size-3.5 text-muted-foreground" />
                  </span>
                  <span className="text-sm text-muted-foreground">Omitidas</span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">{result.skipped_count}</span>
              </div>
            </div>

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-2.5 text-sm"
                  onClick={() => setErrorsExpanded((v) => !v)}
                >
                  <span className="flex items-center gap-2 font-medium text-destructive">
                    <AlertCircle className="size-4" />
                    {result.errors.length} {result.errors.length === 1 ? 'error en la importación' : 'errores en la importación'}
                  </span>
                  {errorsExpanded ? <ChevronUp className="size-4 text-destructive" /> : <ChevronDown className="size-4 text-destructive" />}
                </button>
                {errorsExpanded && (
                  <ul className="max-h-40 overflow-y-auto border-t px-4 py-2 space-y-1 text-xs text-destructive">
                    {result.errors.map((e, i) => <li key={i} className="py-0.5">• {e}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              <Button onClick={() => { setState('idle'); }} className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" /> Sincronizar de nuevo
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
