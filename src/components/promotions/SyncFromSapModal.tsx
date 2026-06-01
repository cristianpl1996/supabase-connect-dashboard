import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, Loader2, AlertCircle, CheckCircle2, Download, ArrowDownToLine,
  AlertTriangle, Info, Clock, WifiOff, ServerCrash, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  previewSapCampaigns, importSapCampaigns, checkSapHealth,
  inferSapErrorType,
  SapCampaignPreview, SapImportResult, SapErrorInfo, SapMessage,
} from '@/lib/api';
import { toast } from 'sonner';

interface SyncFromSapModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

type ModalState = 'loading' | 'preview' | 'importing' | 'result' | 'error';

const SAP_ERROR_MAP: Record<
  string,
  { title: string; description: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  TIMEOUT: {
    title: 'SAP tardó demasiado en responder',
    description: 'El servidor tardó más de 30s. Suele resolverse reintentando.',
    Icon: Clock,
  },
  NETWORK_ERROR: {
    title: 'No se pudo conectar con SAP',
    description: 'Verifica que el servidor SAP esté accesible.',
    Icon: WifiOff,
  },
  SAP_UNAVAILABLE: {
    title: 'SAP no está disponible',
    description: 'El servidor SAP respondió con un error. Intenta en unos minutos.',
    Icon: ServerCrash,
  },
  AUTH_EXPIRED: {
    title: 'Sesión con SAP expirada',
    description: 'La sesión fue renovada automáticamente. Reintenta.',
    Icon: Lock,
  },
  DATA_ERROR: {
    title: 'Error en los datos',
    description: 'Hubo un problema con el formato de los datos. Contacta soporte.',
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

  const label =
    messages.length === 1
      ? severity === 'error' ? '1 error' : severity === 'warning' ? '1 aviso' : '1 info'
      : `${messages.length} ${severity === 'error' ? 'errores' : severity === 'warning' ? 'avisos' : 'info'}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button">
          <Badge variant="outline" className={badgeClass}>{label}</Badge>
        </button>
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

export default function SyncFromSapModal({ open, onClose, onImported }: SyncFromSapModalProps) {
  const [state, setState] = useState<ModalState>('loading');
  const [campaigns, setCampaigns] = useState<SapCampaignPreview[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [errorInfo, setErrorInfo] = useState<SapErrorInfo | null>(null);
  const [result, setResult] = useState<SapImportResult | null>(null);

  const loadPreview = useCallback(async () => {
    setState('loading');
    setErrorInfo(null);

    const [healthSettled, previewSettled] = await Promise.allSettled([
      checkSapHealth(),
      previewSapCampaigns(),
    ]);

    if (previewSettled.status === 'rejected') {
      const info = inferSapErrorType(previewSettled.reason);
      // If health confirmed SAP is down, use NETWORK_ERROR for a clearer message
      if (healthSettled.status === 'fulfilled' && healthSettled.value.status === 'unavailable') {
        setErrorInfo({ ...info, error_type: 'NETWORK_ERROR' });
      } else {
        setErrorInfo(info);
      }
      setState('error');
      return;
    }

    const data = previewSettled.value;
    setCampaigns(data);
    setSelected(new Set(data.map((c) => c.campaign_number)));
    setState('preview');
  }, []);

  useEffect(() => {
    if (open) {
      setResult(null);
      loadPreview();
    }
  }, [open, loadPreview]);

  const allSelected = campaigns.length > 0 && selected.size === campaigns.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(campaigns.map((c) => c.campaign_number)));
  };

  const toggleOne = (campaignNumber: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(campaignNumber)) next.delete(campaignNumber);
      else next.add(campaignNumber);
      return next;
    });
  };

  const counts = useMemo(() => {
    let create = 0;
    let update = 0;
    campaigns.forEach((c) => {
      if (selected.has(c.campaign_number)) {
        if (c.action === 'create') create += 1;
        else update += 1;
      }
    });
    return { create, update };
  }, [campaigns, selected]);

  const handleImport = async () => {
    if (selected.size === 0) {
      toast.error('Selecciona al menos una campaña');
      return;
    }
    setState('importing');
    try {
      const res = await importSapCampaigns(Array.from(selected));
      setResult(res);
      setState('result');
      if (res.errors.length === 0) {
        toast.success(`Sincronización completa: ${res.imported_count} creadas, ${res.updated_count} actualizadas`);
      } else {
        toast.warning(`Sincronización con ${res.errors.length} error(es)`);
      }
      onImported();
    } catch (err) {
      setErrorInfo(inferSapErrorType(err));
      setState('error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-green-600" />
            Sincronizar promociones desde SAP
          </DialogTitle>
        </DialogHeader>

        {state === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Consultando campañas en SAP…</p>
          </div>
        )}

        {state === 'error' && errorInfo && (() => {
          const mapping = SAP_ERROR_MAP[errorInfo.error_type] ?? {
            title: 'Error inesperado',
            description: errorInfo.message,
            Icon: AlertCircle,
          };
          const { title, description, Icon } = mapping;
          const iconClass = cn(
            'h-10 w-10',
            errorInfo.error_type === 'TIMEOUT' || errorInfo.error_type === 'AUTH_EXPIRED'
              ? 'text-amber-500'
              : 'text-red-500',
          );
          return (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <Icon className={iconClass} />
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
              {errorInfo.is_retryable && (
                <Button variant="outline" onClick={loadPreview}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
                </Button>
              )}
            </div>
          );
        })()}

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
                          <Checkbox
                            checked={selected.has(c.campaign_number)}
                            onCheckedChange={() => toggleOne(c.campaign_number)}
                            aria-label={`Seleccionar campaña ${c.campaign_number}`}
                          />
                        </td>
                        <td className="p-2 text-muted-foreground">#{c.campaign_number}</td>
                        <td className="p-2 font-medium">{c.title || '(sin título)'}</td>
                        <td className="p-2">
                          <MessagesBadge messages={c.messages} />
                        </td>
                        <td className="p-2">{c.laboratory_name || <span className="text-amber-600">—</span>}</td>
                        <td className="p-2 text-muted-foreground whitespace-nowrap">{c.start_date} → {c.end_date}</td>
                        <td className="p-2">
                          {c.action === 'create' ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-600">Nueva</Badge>
                          ) : (
                            <Badge variant="secondary">Actualizar</Badge>
                          )}
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
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleImport} disabled={selected.size === 0}>
                  <ArrowDownToLine className="h-4 w-4 mr-2" /> Importar seleccionadas
                </Button>
              </div>
            </div>
          </>
        )}

        {state === 'importing' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Importando campañas a Ivanagro…</p>
          </div>
        )}

        {state === 'result' && result && (
          <div className="py-6 space-y-4">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="text-lg font-medium">Sincronización finalizada</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md border p-3">
                <div className="text-2xl font-semibold text-green-600">{result.imported_count}</div>
                <div className="text-xs text-muted-foreground">Creadas</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-2xl font-semibold text-blue-600">{result.updated_count}</div>
                <div className="text-xs text-muted-foreground">Actualizadas</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-2xl font-semibold text-amber-600">{result.skipped_count}</div>
                <div className="text-xs text-muted-foreground">Omitidas</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 max-h-40 overflow-y-auto">
                <p className="text-sm font-medium text-amber-800 mb-1">Detalles:</p>
                <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={loadPreview}>
                <Download className="h-4 w-4 mr-2" /> Ver de nuevo
              </Button>
              <Button onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
