import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, Loader2, AlertCircle, CheckCircle2, Download, ArrowDownToLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  previewSapCampaigns, importSapCampaigns,
  SapCampaignPreview, SapImportResult,
} from '@/lib/api';
import { toast } from 'sonner';

interface SyncFromSapModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

type ModalState = 'loading' | 'preview' | 'importing' | 'result' | 'error';

export default function SyncFromSapModal({ open, onClose, onImported }: SyncFromSapModalProps) {
  const [state, setState] = useState<ModalState>('loading');
  const [campaigns, setCampaigns] = useState<SapCampaignPreview[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [result, setResult] = useState<SapImportResult | null>(null);

  const loadPreview = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const data = await previewSapCampaigns();
      setCampaigns(data);
      // Pre-select everything that has no blocking warnings
      setSelected(new Set(data.map((c) => c.campaign_number)));
      setState('preview');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'No se pudieron cargar las campañas de SAP');
      setState('error');
    }
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
      setErrorMessage(err instanceof Error ? err.message : 'Error al importar campañas');
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

        {state === 'error' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <p className="text-center text-sm text-muted-foreground max-w-md">{errorMessage}</p>
            <Button variant="outline" onClick={loadPreview}>
              <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
            </Button>
          </div>
        )}

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
                        <td className="p-2">
                          <div className="font-medium">{c.title || '(sin título)'}</div>
                          {c.warnings.length > 0 && (
                            <div className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                              <AlertCircle className="h-3 w-3" /> {c.warnings.join(' · ')}
                            </div>
                          )}
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
